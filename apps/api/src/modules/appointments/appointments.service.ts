import {
  ActivityLogAction,
  ActivityLogEntityType,
  type AppointmentQuery,
  type AssignBookingStaffInput,
  type CreateAppointmentInput,
  CreateAppointmentSchema,
  type UpdateAppointmentInput,
  UpdateAppointmentSchema,
} from "@metastorage/contracts";
import type { AppointmentRecord, Database } from "@metastorage/database";
import {
  APPOINTMENT_STATUSES as Status,
  APPOINTMENT_TYPES as Type,
} from "@metastorage/database/schema/appointments";
import { ReservationStatus } from "@metastorage/database/schema/reservations";
import { type Role, UserRole } from "@metastorage/database/schema/user-enums";
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/app-error";
import { isDevelopmentEnvironment } from "../../config/env";
import { beginActivity } from "../activity-logs/activity-logs.service";
import { getFacilityAccessScope } from "../facilities/facilities.access";
import { FacilitiesRepository } from "../facilities/facilities.repository";
import { FacilitiesService } from "../facilities/facilities.service";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import {
  createFacilityTasksService,
  type FacilityTasksService,
} from "../facility-tasks/facility-tasks.service";
import { LIFECYCLE_MAIL_DETAIL as mailDetail } from "../notifications/lifecycle-notifications.messages";
import { recordLifecycleEvent } from "../notifications/lifecycle-notifications.repository";
import type { NotificationsService } from "../notifications/notifications.service";
import { RentalsRepository } from "../rentals/rentals.repository";
import { RentalsService } from "../rentals/rentals.service";
import {
  createReservationsService,
  type ReservationsService,
} from "../reservations/reservations.service";
import { StorageUnitsRepository } from "../storage-units/storage-units.repository";
import { StorageUnitsService } from "../storage-units/storage-units.service";
import { SupportRepository } from "../support/support.repository";
import { SupportService } from "../support/support.service";
import { APPOINTMENT_MESSAGES as m } from "./appointments.messages";
import { AppointmentsRepository, type AppointmentTransaction } from "./appointments.repository";
import { CheckInSlotsRepository } from "./check-in-slots.repository";
import { CheckInSlotsService } from "./check-in-slots.service";

type Actor = { id: string; role: Role | null | undefined };

export class AppointmentsService {
  constructor(
    private readonly repository: AppointmentsRepository,
    private readonly assignments: FacilityAssignmentsService,
    private readonly facilities: FacilitiesService,
    private readonly slots: CheckInSlotsService,
    private readonly reservations: ReservationsService,
    private readonly rentals: RentalsService,
    private readonly support: SupportService,
    private readonly tasks: FacilityTasksService,
    private readonly storageUnits: StorageUnitsService,
    private readonly notifications?: NotificationsService,
  ) {}

  async requireInspectionContext(tx: AppointmentTransaction, id: string, actor: Actor) {
    const current = await this.requireAppointment(id);
    const reservation = current.reservationId
      ? await this.reservations.requireCustomerReservation(
          current.reservationId,
          current.customerId,
          tx,
        )
      : undefined;
    const rental = current.rentalId
      ? await this.rentals.requireAppointmentContext(tx, current.rentalId, current.customerId)
      : undefined;
    const appointment = await this.requireAppointment(id, tx);
    await this.assertAccess(appointment, actor);
    if (actor.role !== UserRole.FACILITY_STAFF || appointment.assignedStaffId !== actor.id)
      throw new ForbiddenError(m.accessDenied);
    const slot = await this.slots.findByIdForDate(appointment.slotId, appointment.scheduledDate);
    const now = new Date();
    const sameDayAllowed =
      slot &&
      appointment.appointmentType === Type.CHECK_IN &&
      this.slots.allowsCheckInDuringSameDaySlot(slot, appointment.scheduledDate, now);
    if (
      !slot ||
      (!isDevelopmentEnvironment() &&
        !sameDayAllowed &&
        (now < slot.startsAt || now >= new Date(`${appointment.scheduledDate}T23:59:59.999+07:00`)))
    )
      throw new ConflictError(m.completionNotReady);
    if (appointment.status !== Status.CONFIRMED && appointment.status !== Status.COMPLETED)
      throw new ConflictError(m.completionNotReady);
    return { appointment, reservation, rental };
  }

  async completeHandover(tx: AppointmentTransaction, id: string, actor: Actor) {
    await this.tasks.finishAppointment(tx, id, true, actor.id);
    const updated = await this.repository.update(id, { status: Status.COMPLETED }, tx);
    if (!updated) throw new AppError(m.writeFailed);
    return updated;
  }

  listCheckInSlots() {
    return this.slots.list();
  }

  async scheduleAppointment(input: CreateAppointmentInput, customerId: string) {
    input = CreateAppointmentSchema.parse(input);
    const slot = await this.slots.findByIdForDate(input.slotId, input.scheduledDate);
    const now = new Date();
    const demo = isDevelopmentEnvironment();
    const sameDaySchedulingAllowed = Boolean(
      slot &&
        (input.appointmentType === Type.CHECK_IN || input.appointmentType === Type.CHECK_OUT) &&
        this.slots.allowsSameDayReservation(slot, input.scheduledDate, now),
    );
    if (
      !slot ||
      (!sameDaySchedulingAllowed && (slot.endsAt <= now || (!demo && slot.startsAt <= now)))
    )
      throw new BadRequestError(m.invalidSlot);
    const sameDayDemoSlotAllowed = Boolean(slot.sameDayCheckInEnabled && sameDaySchedulingAllowed);
    const scheduled = await this.repository.transaction(async (tx) => {
      let facilityId: string;
      if (input.appointmentType === Type.CHECK_IN) {
        if (!input.reservationId) throw new BadRequestError(m.contextMismatch);
        const reservation = await this.reservations.requireCustomerReservation(
          input.reservationId,
          customerId,
          tx,
        );
        if (
          ![ReservationStatus.DRAFT, ReservationStatus.CONFIRMED].includes(
            reservation.status as ReservationStatus.DRAFT | ReservationStatus.CONFIRMED,
          )
        )
          throw new ConflictError(m.reservationNotConfirmed);
        if (slot.startsAt.getTime() !== reservation.rentalStartAt.getTime())
          throw new ConflictError(m.scheduleMismatch);
        facilityId = reservation.facilityId;
      } else if (input.appointmentType === Type.CHECK_OUT) {
        if (!input.rentalId) throw new BadRequestError(m.contextMismatch);
        const context = await this.rentals.requireAppointmentContext(
          tx,
          input.rentalId,
          customerId,
        );
        await this.rentals.requireNoPendingRenewalPayment(tx, context.rental.id);
        // A same-day check-in slot ignores its window, so it may start before the handover time.
        const sameDayDemoSlot = this.slots.allowsCheckInDuringSameDaySlot(
          slot,
          input.scheduledDate,
          now,
        );
        if (!sameDayDemoSlot && slot.startsAt < context.rental.startAt)
          throw new BadRequestError(m.scheduleMismatch);
        facilityId = context.facilityId;
      } else {
        if (!input.supportTicketId) throw new BadRequestError(m.contextMismatch);
        const ticket = await this.support.requireCustomerTicket(
          tx,
          input.supportTicketId,
          customerId,
        );
        facilityId = ticket.facilityId;
      }
      if (input.facilityId && input.facilityId !== facilityId)
        throw new BadRequestError(m.contextMismatch);
      await this.facilities.requireActiveFacility(facilityId);
      if (!demo && !sameDayDemoSlotAllowed) {
        await this.facilities.assertCheckInWithinOperatingHours(
          slot.startsAt,
          new Date(slot.endsAt.getTime() - 1),
        );
      }
      if (await this.repository.findActiveForContext(tx, input))
        throw new ConflictError(m.alreadyScheduled);
      const appointment = await this.repository.create(
        { ...input, facilityId, customerId, createdBy: customerId },
        tx,
      );
      if (!appointment) throw new AppError(m.writeFailed);
      if (appointment.rentalId && appointment.appointmentType === Type.CHECK_OUT)
        await recordLifecycleEvent(tx, {
          key: `appointment:${appointment.id}:created`,
          type: "RETURN_CHANGED",
          rentalId: appointment.rentalId,
          detail: mailDetail.returnRequested(appointment.scheduledDate),
        });
      if (appointment.supportTicketId)
        await recordLifecycleEvent(tx, {
          key: `appointment:${appointment.id}:created`,
          type: "SUPPORT_UPDATED",
          supportTicketId: appointment.supportTicketId,
          detail: mailDetail.supportScheduled(appointment.scheduledDate),
        });
      return appointment;
    });
    await this.notifications?.appointmentChanged(scheduled.id);
    return scheduled;
  }

  listCustomerAppointments(query: AppointmentQuery, customerId: string) {
    return this.repository.list({ ...query, customerId });
  }

  async listFacilityAppointments(facilityId: string, query: AppointmentQuery, actor: Actor) {
    if (actor.role !== UserRole.FACILITY_MANAGER) throw new ForbiddenError(m.accessDenied);
    await this.assignments.requireFacilityAccess(facilityId, getFacilityAccessScope(actor), [
      UserRole.FACILITY_MANAGER,
    ]);
    return this.repository.list({ ...query, facilityId });
  }

  async listAssignedAppointments(staffId: string, query: AppointmentQuery) {
    const facilityId =
      query.facilityId ??
      (await this.assignments.getActiveFacilityId(staffId, UserRole.FACILITY_STAFF));
    await this.assignments.requireFacilityAccess(
      facilityId,
      getFacilityAccessScope({ id: staffId, role: UserRole.FACILITY_STAFF }),
      [UserRole.FACILITY_STAFF],
    );
    return this.repository.list({ ...query, facilityId, assignedStaffId: staffId });
  }

  private async requireAppointment(id: string, tx?: AppointmentTransaction) {
    const appointment = tx
      ? await this.repository.findByIdForUpdate(id, tx)
      : await this.repository.findById(id);
    if (!appointment) throw new NotFoundError(m.notFound);
    return appointment;
  }

  private async assertAccess(appointment: AppointmentRecord, actor: Actor) {
    if (actor.role === UserRole.STORAGE_CUSTOMER) {
      if (appointment.customerId !== actor.id) throw new NotFoundError(m.notFound);
      return;
    }
    if (actor.role === UserRole.FACILITY_STAFF && appointment.assignedStaffId !== actor.id)
      throw new ForbiddenError(m.accessDenied);
    await this.assignments.requireFacilityAccess(
      appointment.facilityId,
      getFacilityAccessScope(actor),
    );
  }

  async getAppointment(id: string, actor: Actor) {
    const appointment = await this.requireAppointment(id);
    await this.assertAccess(appointment, actor);
    return appointment;
  }

  assignAppointmentStaff(id: string, input: AssignBookingStaffInput, managerId: string) {
    return this.updateAppointment(
      id,
      { assignedStaffId: input.staffId },
      { id: managerId, role: UserRole.FACILITY_MANAGER },
    );
  }

  async updateAppointment(id: string, input: UpdateAppointmentInput, actor: Actor) {
    input = UpdateAppointmentSchema.parse(input);
    if (!Object.keys(input).length) throw new BadRequestError(m.emptyUpdate);
    const current = await this.getAppointment(id, actor);
    const supportActivity =
      current.appointmentType === "SUPPORT" && input.status === "COMPLETED"
        ? beginActivity({
            action: ActivityLogAction.RESOLVE,
            entityType: ActivityLogEntityType.SUPPORT,
            entityId: current.supportTicketId,
            facilityId: current.facilityId,
            description: "Complete support appointment",
          })
        : undefined;
    const demo = isDevelopmentEnvironment();
    let unitChanged = false;
    const updated = await this.repository.transaction(async (tx) => {
      // Use the same parent -> appointment lock order as reservation cancellation.
      const reservation = current.reservationId
        ? await this.reservations.requireCustomerReservation(
            current.reservationId,
            current.customerId,
            tx,
          )
        : undefined;
      const appointment = await this.requireAppointment(id, tx);
      await this.assertAccess(appointment, actor);
      if (
        appointment.status === Status.COMPLETED ||
        appointment.status === Status.CANCELLED ||
        appointment.status === Status.NO_SHOW
      )
        throw new ConflictError(m.closed);
      if (actor.role === UserRole.STORAGE_CUSTOMER) {
        if (
          input.status !== Status.CANCELLED ||
          input.assignedStaffId !== undefined ||
          input.physicalUnitId !== undefined ||
          input.assignmentReason !== undefined ||
          input.notes !== undefined
        )
          throw new ForbiddenError(m.accessDenied);
      } else if (
        actor.role !== UserRole.FACILITY_MANAGER &&
        actor.role !== UserRole.FACILITY_STAFF
      ) {
        throw new ForbiddenError(m.accessDenied);
      }
      if (input.assignedStaffId !== undefined && actor.role !== UserRole.FACILITY_MANAGER)
        throw new ForbiddenError(m.accessDenied);
      const slot = await this.slots.findByIdForDate(appointment.slotId, appointment.scheduledDate);
      if (!slot) throw new BadRequestError(m.invalidSlot);
      const now = new Date();
      const sameDayAllowed =
        (appointment.appointmentType === Type.CHECK_IN ||
          appointment.appointmentType === Type.CHECK_OUT) &&
        this.slots.allowsCheckInDuringSameDaySlot(slot, appointment.scheduledDate, now);
      const status = input.status ?? appointment.status;
      if (status === Status.CANCELLED && actor.role === UserRole.FACILITY_STAFF)
        throw new ForbiddenError(m.accessDenied);
      if (status !== appointment.status) {
        if (appointment.status === Status.CONFIRMED && status === Status.SCHEDULED)
          throw new ConflictError(m.invalidTransition);
        if (
          status === Status.COMPLETED &&
          (actor.role !== UserRole.FACILITY_STAFF ||
            appointment.assignedStaffId !== actor.id ||
            appointment.status !== Status.CONFIRMED ||
            (!demo &&
              !sameDayAllowed &&
              (now < slot.startsAt ||
                now >= new Date(`${appointment.scheduledDate}T23:59:59.999+07:00`))))
        )
          throw new ConflictError(m.completionNotReady);
        if (
          status === Status.COMPLETED &&
          appointment.appointmentType === Type.CHECK_IN &&
          reservation?.status !== ReservationStatus.CHECKED_IN
        )
          throw new ConflictError(m.handoverRequired);
        if (status === Status.COMPLETED && appointment.appointmentType === Type.CHECK_OUT) {
          if (!appointment.rentalId) throw new ConflictError(m.contextMismatch);
          const rental = await this.rentals.getCustomerRental(
            appointment.rentalId,
            appointment.customerId,
          );
          if (rental.status !== "CLOSED") throw new ConflictError(m.returnRequired);
        }
        if (
          status === Status.NO_SHOW &&
          (actor.role !== UserRole.FACILITY_MANAGER || now < slot.endsAt)
        )
          throw new ConflictError(m.noShowNotReady);
        if (
          status === Status.CANCELLED &&
          actor.role === UserRole.STORAGE_CUSTOMER &&
          !sameDayAllowed &&
          now >= slot.startsAt
        )
          throw new ConflictError(m.cancellationClosed);
        if (status === Status.CONFIRMED && actor.role !== UserRole.FACILITY_MANAGER)
          throw new ForbiddenError(m.accessDenied);
      }
      if (
        reservation &&
        (input.physicalUnitId || input.assignedStaffId || status === Status.CONFIRMED) &&
        reservation.status !== ReservationStatus.CONFIRMED
      )
        throw new ConflictError(m.reservationNotConfirmed);
      let unitReassigned = false;
      if (input.physicalUnitId) {
        if (
          actor.role !== UserRole.FACILITY_MANAGER ||
          !reservation ||
          appointment.appointmentType !== Type.CHECK_IN
        )
          throw new ForbiddenError(m.accessDenied);
        const unitResult = await this.storageUnits.assignReservationUnit(tx, {
          reservationId: reservation.id,
          unitId: input.physicalUnitId,
          facilityId: reservation.facilityId,
          unitTypeId: reservation.unitTypeId,
          startsAt: reservation.rentalStartAt,
          endsAt: reservation.rentalEndAt,
          managerId: actor.id,
          reason: input.assignmentReason,
        });
        unitChanged = unitResult.changed;
        unitReassigned = unitResult.reassigned;
      }
      if (status === Status.CANCELLED && reservation)
        await this.storageUnits.closeReservationAssignment(tx, reservation.id, "CANCELLED");
      const assignedStaffId = input.assignedStaffId ?? appointment.assignedStaffId;
      if (status === Status.CONFIRMED && !assignedStaffId)
        throw new BadRequestError(m.staffRequired);
      if (input.assignedStaffId && !demo && !sameDayAllowed && now >= slot.endsAt)
        throw new ConflictError(m.closed);
      if (
        input.assignedStaffId ||
        (actor.role === UserRole.FACILITY_MANAGER &&
          assignedStaffId &&
          (status === Status.CONFIRMED || unitReassigned) &&
          (input.physicalUnitId || input.status === Status.CONFIRMED))
      ) {
        await this.tasks.assignAppointment(tx, { ...appointment, assignedStaffId }, actor.id, {
          resetInProgress: unitReassigned,
        });
      }
      if (status === Status.COMPLETED || status === Status.CANCELLED || status === Status.NO_SHOW)
        await this.tasks.finishAppointment(
          tx,
          appointment.id,
          status === Status.COMPLETED,
          actor.id,
        );
      const updated = await this.repository.update(id, input, tx);
      if (!updated) throw new AppError(m.writeFailed);
      if (updated.status !== appointment.status) {
        if (appointment.rentalId && appointment.appointmentType === Type.CHECK_OUT)
          await recordLifecycleEvent(tx, {
            key: `appointment:${id}:${updated.status}`,
            type: updated.status === Status.CONFIRMED ? "RETURN_SCHEDULED" : "RETURN_CHANGED",
            rentalId: appointment.rentalId,
            detail: mailDetail.appointmentUpdated(
              "return",
              appointment.scheduledDate,
              updated.status,
            ),
          });
        if (appointment.supportTicketId)
          await recordLifecycleEvent(tx, {
            key: `appointment:${id}:${updated.status}`,
            type: "SUPPORT_UPDATED",
            supportTicketId: appointment.supportTicketId,
            detail: mailDetail.appointmentUpdated(
              "support",
              appointment.scheduledDate,
              updated.status,
            ),
          });
      }
      return updated;
    });
    if (supportActivity) supportActivity.changed = updated.status !== current.status;
    const notifyStaffId =
      input.assignedStaffId && input.assignedStaffId !== current.assignedStaffId
        ? input.assignedStaffId
        : unitChanged && updated.assignedStaffId
          ? updated.assignedStaffId
          : undefined;
    if (notifyStaffId && this.notifications) {
      try {
        await this.notifications.assignedAppointment(id, notifyStaffId);
      } catch {
        console.error("Appointment assignment notification failed");
      }
    }
    await this.notifications?.appointmentChanged(updated.id, current.assignedStaffId);
    return updated;
  }
}

export function createAppointmentsService(db: Database, notifications?: NotificationsService) {
  const facilities = new FacilitiesRepository(db);
  const assignmentRepo = new FacilityAssignmentsRepository(db);
  const assignments = new FacilityAssignmentsService(assignmentRepo, facilities);
  return new AppointmentsService(
    new AppointmentsRepository(db),
    assignments,
    new FacilitiesService(facilities),
    new CheckInSlotsService(new CheckInSlotsRepository(db)),
    createReservationsService(db),
    new RentalsService(new RentalsRepository(db), assignments),
    new SupportService(new SupportRepository(db)),
    createFacilityTasksService(db),
    new StorageUnitsService(new StorageUnitsRepository(db)),
    notifications,
  );
}
