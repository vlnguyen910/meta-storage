import type {
  CreateReservationInput,
  ReservationQuery,
  UpdateReservationInput,
} from "@metastorage/contracts";
import { UserRole } from "@metastorage/contracts";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import type { AuthenticatedActor } from "../auth/authenticated-actor";
import { getFacilityAccessScope } from "../facilities/facilities.access";
import type { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import { RESERVATION_MESSAGES } from "./reservations.messages";
import type { ReservationsRepository } from "./reservations.repository";

const VIETNAM_UTC_OFFSET_MILLISECONDS = 7 * 60 * 60 * 1000;

function calculateRentalEndAt(startAt: string, months: number) {
  const rentalStart = new Date(startAt);
  if (rentalStart <= new Date()) throw new BadRequestError(RESERVATION_MESSAGES.futureStart);
  const localStart = new Date(rentalStart.getTime() + VIETNAM_UTC_OFFSET_MILLISECONDS);
  const startDay = localStart.getUTCDate();
  localStart.setUTCDate(1);
  localStart.setUTCMonth(localStart.getUTCMonth() + months + 1, 0);
  localStart.setUTCDate(Math.min(startDay, localStart.getUTCDate()));
  return new Date(localStart.getTime() - VIETNAM_UTC_OFFSET_MILLISECONDS);
}

export class ReservationsService {
  constructor(
    private readonly reservationsRepository: ReservationsRepository,
    private readonly facilityAssignmentsService: FacilityAssignmentsService,
  ) {}

  async createReservation(input: CreateReservationInput, actor: AuthenticatedActor) {
    const unitType = await this.reservationsRepository.findActiveUnitType(
      input.facilityId,
      input.unitTypeId,
    );
    if (!unitType) throw new NotFoundError(RESERVATION_MESSAGES.unitTypeNotFound);
    const rentalEndAt = calculateRentalEndAt(input.startAt, input.requestedMonths);
    const monthlyRate = unitType.monthlyPrice;
    return this.reservationsRepository.createReservation({
      customerId: actor.id,
      facilityId: input.facilityId,
      unitTypeId: input.unitTypeId,
      requestedMonths: input.requestedMonths,
      rentalStartAt: new Date(input.startAt),
      rentalEndAt,
      monthlyRateSnapshot: String(monthlyRate),
      rentalFeeAmount: String(monthlyRate * input.requestedMonths),
      depositAmount: String(monthlyRate),
      totalAmount: String(monthlyRate * (input.requestedMonths + 1)),
    });
  }

  async listReservations(query: ReservationQuery, actor: AuthenticatedActor) {
    if (actor.role === UserRole.STORAGE_CUSTOMER)
      return this.reservationsRepository.listReservations(
        query,
        actor.id,
        actor.facilityId ?? query.facilityId,
      );
    const facilityScope = getFacilityAccessScope(actor);
    const facilityId =
      actor.facilityId ??
      query.facilityId ??
      (facilityScope.kind === "assigned"
        ? await this.facilityAssignmentsService.getActiveFacilityId(actor.id, facilityScope.role)
        : undefined);
    if (facilityId)
      await this.facilityAssignmentsService.requireFacilityAccess(facilityId, facilityScope);
    return this.reservationsRepository.listReservations(query, undefined, facilityId);
  }

  async getReservation(reservationId: string, actor: AuthenticatedActor) {
    const reservation = await this.reservationsRepository.findReservationById(reservationId);
    if (!reservation) throw new NotFoundError(RESERVATION_MESSAGES.notFound);
    if (actor.role === UserRole.STORAGE_CUSTOMER) {
      if (reservation.customerId !== actor.id) throw new ForbiddenError();
    } else
      await this.facilityAssignmentsService.requireFacilityAccess(
        reservation.facilityId,
        getFacilityAccessScope(actor),
      );
    return reservation;
  }

  async updateReservation(
    reservationId: string,
    input: UpdateReservationInput,
    actor: AuthenticatedActor,
  ) {
    const reservation = await this.getReservation(reservationId, actor);
    if (actor.role !== UserRole.STORAGE_CUSTOMER || reservation.customerId !== actor.id)
      throw new ForbiddenError();
    const rentalEndAt = calculateRentalEndAt(input.startAt, input.requestedMonths);
    const monthlyRate = Number(reservation.monthlyRateSnapshot);
    const updatedReservation = await this.reservationsRepository.updateReservation(
      reservationId,
      actor.id,
      {
        rentalEndAt,
        rentalStartAt: new Date(input.startAt),
        requestedMonths: input.requestedMonths,
        rentalFeeAmount: String(monthlyRate * input.requestedMonths),
        totalAmount: String(
          monthlyRate * input.requestedMonths + Number(reservation.depositAmount),
        ),
      },
    );
    if (!updatedReservation) throw new NotFoundError(RESERVATION_MESSAGES.notFound);
    return updatedReservation;
  }
}
