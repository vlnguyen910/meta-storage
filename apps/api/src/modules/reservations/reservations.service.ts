import {
  type BookingDraftInput,
  BookingDraftInputSchema,
  type BookingPaymentInput,
  type ReservationQuery,
} from "@metastorage/contracts";
import type { Database, ReservationRecord } from "@metastorage/database";
import { APPOINTMENT_STATUSES } from "@metastorage/database/schema/appointments";
import { ReservationStatus } from "@metastorage/database/schema/reservations";
import { type Role, UserRole } from "@metastorage/database/schema/user-enums";
import { localDate } from "../../common/date";
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../common/errors/app-error";
import { AppointmentsRepository } from "../appointments/appointments.repository";
import { CheckInSlotsRepository } from "../bookings/check-in-slots.repository";
import { CheckInSlotsService } from "../bookings/check-in-slots.service";
import { getFacilityAccessScope } from "../facilities/facilities.access";
import { FacilitiesRepository } from "../facilities/facilities.repository";
import { FacilitiesService } from "../facilities/facilities.service";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import {
  createFacilityTasksService,
  type FacilityTasksService,
} from "../facility-tasks/facility-tasks.service";
import { createSepayGateway } from "../payments/payments.service";
import {
  createReservationPaymentsService,
  type ReservationPaymentsService,
} from "../payments/reservation-payments.service";
import { PricingRepository } from "../pricing/pricing.repository";
import { PricingService } from "../pricing/pricing.service";
import { StorageUnitsRepository } from "../storage-units/storage-units.repository";
import { StorageUnitsService } from "../storage-units/storage-units.service";
import { SystemSettingsRepository } from "../system-settings/system-settings.repository";
import { SystemSettingsService } from "../system-settings/system-settings.service";
import { FacilityUnitTypesRepository } from "../unit-types/facility-unit-types.repository";
import { FacilityUnitTypesService } from "../unit-types/facility-unit-types.service";
import { RESERVATION_RECORD_MESSAGES as m } from "./reservations.messages";
import { ReservationsRepository, type ReservationTransaction } from "./reservations.repository";

export class ReservationsService {
  constructor(
    private readonly repository: ReservationsRepository,
    private readonly assignments: FacilityAssignmentsService,
    private readonly facilities: FacilitiesService,
    private readonly unitTypes: FacilityUnitTypesService,
    private readonly slots: CheckInSlotsService,
    private readonly storageUnits: StorageUnitsService,
    private readonly pricing: PricingService,
    private readonly payments: ReservationPaymentsService,
    private readonly appointments: AppointmentsRepository,
    private readonly tasks: FacilityTasksService,
    private readonly settings: SystemSettingsService,
  ) {}

  async createReservationDraft(input: BookingDraftInput, customerId: string) {
    input = BookingDraftInputSchema.parse(input);
    if (input.checkInDate <= localDate(new Date(), "Asia/Ho_Chi_Minh"))
      throw new BadRequestError(m.futureDateRequired);
    await this.facilities.requireActiveFacility(input.facilityId);
    const unitType = await this.unitTypes.requireActiveUnitType(input.facilityId, input.unitTypeId);
    const slot = await this.slots.findByIdForDate(input.checkInSlotId, input.checkInDate);
    if (!slot || slot.startsAt <= new Date()) throw new BadRequestError(m.invalidSlot);
    await this.facilities.assertCheckInWithinOperatingHours(input.facilityId, slot.startsAt);
    const rentalEndAt = new Date(slot.startsAt);
    rentalEndAt.setUTCDate(rentalEndAt.getUTCDate() + input.durationMonths * 30);
    if (
      (await this.storageUnits.getAvailableCapacity(
        input.facilityId,
        unitType.id,
        slot.startsAt,
        rentalEndAt,
      )) < 1
    )
      throw new ConflictError(m.capacityUnavailable);
    const pricing = await this.pricing.quote(unitType.id, input.durationMonths);
    // Reservation amounts are PostgreSQL INTEGER; reject overflow before persistence.
    if (BigInt(pricing.totalAmount) > 2147483647n) throw new BadRequestError(m.amountOutOfRange);
    return this.repository.transaction(async (tx) => {
      const reservation = await this.repository.create(
        {
          customerId,
          facilityId: input.facilityId,
          unitTypeId: unitType.id,
          requestedMonths: input.durationMonths,
          rentalStartAt: slot.startsAt,
          rentalEndAt,
          monthlyRateSnapshot: Number(pricing.monthlyRateSnapshot),
          rentalFeeAmount: Number(pricing.rentalFeeAmount),
          depositAmount: Number(pricing.depositAmount),
          totalAmount: Number(pricing.totalAmount),
        },
        tx,
      );
      if (!reservation) throw new AppError(m.writeFailed);
      return reservation;
    });
  }

  async markCheckedIn(tx: ReservationTransaction, id: string) {
    await this.payments.releaseAfterHandover(tx, id);
    return this.repository.updateStatus(id, ReservationStatus.CHECKED_IN, tx);
  }

  listCustomerReservations(customerId: string, query: ReservationQuery) {
    return this.repository.list({ ...query, customerId });
  }

  async requireCustomerReservation(id: string, customerId: string, tx?: ReservationTransaction) {
    const reservation = tx
      ? await this.repository.findByIdForUpdate(id, tx)
      : await this.repository.findById(id);
    if (!reservation || reservation.customerId !== customerId) throw new NotFoundError(m.notFound);
    return reservation;
  }

  getCustomerReservation(id: string, customerId: string) {
    return this.requireCustomerReservation(id, customerId);
  }

  async listFacilityReservations(facilityId: string, query: ReservationQuery, managerId: string) {
    await this.assignments.requireFacilityAccess(
      facilityId,
      getFacilityAccessScope({ id: managerId, role: UserRole.FACILITY_MANAGER }),
      [UserRole.FACILITY_MANAGER],
    );
    return this.repository.list({ ...query, facilityId });
  }

  async getReservation(id: string, actor: { id: string; role: Role | null | undefined }) {
    if (actor.role === UserRole.STORAGE_CUSTOMER) return this.getCustomerReservation(id, actor.id);
    const reservation = await this.repository.findById(id);
    if (!reservation) throw new NotFoundError(m.notFound);
    await this.assignments.requireFacilityAccess(
      reservation.facilityId,
      getFacilityAccessScope(actor),
      [UserRole.FACILITY_MANAGER],
    );
    return reservation;
  }

  cancelReservation(id: string, customerId: string) {
    return this.repository.transaction(async (tx) => {
      const reservation = await this.requireCustomerReservation(id, customerId, tx);
      if (reservation.status === ReservationStatus.CANCELLED) return reservation;
      if (
        reservation.status !== ReservationStatus.DRAFT &&
        reservation.status !== ReservationStatus.CONFIRMED
      )
        throw new ConflictError(m.cancellationClosed);
      return this.closeReservation(tx, reservation, ReservationStatus.CANCELLED);
    });
  }

  startReservationPayment(id: string, input: BookingPaymentInput, customerId: string) {
    return this.payments.startPayment(id, input, customerId);
  }

  private async closeReservation(
    tx: ReservationTransaction,
    reservation: ReservationRecord,
    status: ReservationStatus.CANCELLED | ReservationStatus.NO_SHOW,
  ) {
    await this.payments.cancel(
      tx,
      reservation,
      status === ReservationStatus.NO_SHOW ? "NO_SHOW" : "CUSTOMER_CANCELLATION",
    );
    const appointments = await this.appointments.closeForReservation(
      tx,
      reservation.id,
      status === ReservationStatus.NO_SHOW
        ? APPOINTMENT_STATUSES.NO_SHOW
        : APPOINTMENT_STATUSES.CANCELLED,
    );
    for (const appointment of appointments)
      await this.tasks.finishAppointment(tx, appointment.id, false, reservation.customerId);
    const updated = await this.repository.updateStatus(reservation.id, status, tx);
    if (!updated) throw new AppError(m.writeFailed);
    return updated;
  }

  async sweepNoShows(now = new Date(), facilityId?: string) {
    const closingHour = await this.settings.getClosingHour();
    return this.repository.transaction(async (tx) => {
      const reservations = await this.repository.findNoShows(tx, now, closingHour, facilityId);
      for (const reservation of reservations) {
        await this.closeReservation(tx, reservation, ReservationStatus.NO_SHOW);
      }
      return { processed: reservations.length };
    });
  }
}

export function createReservationsService(db: Database) {
  const facilities = new FacilitiesRepository(db);
  return new ReservationsService(
    new ReservationsRepository(db),
    new FacilityAssignmentsService(new FacilityAssignmentsRepository(db), facilities),
    new FacilitiesService(facilities),
    new FacilityUnitTypesService(new FacilityUnitTypesRepository(db), facilities),
    new CheckInSlotsService(new CheckInSlotsRepository(db)),
    new StorageUnitsService(new StorageUnitsRepository(db)),
    new PricingService(new PricingRepository(db)),
    createReservationPaymentsService(db, createSepayGateway()),
    new AppointmentsRepository(db),
    createFacilityTasksService(db),
    new SystemSettingsService(new SystemSettingsRepository(db)),
  );
}
