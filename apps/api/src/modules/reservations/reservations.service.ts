import type {
  CreateReservationInput,
  ReservationQuery,
  UpdateReservationInput,
} from "@metastorage/contracts";
import { UserRole } from "@metastorage/contracts";
import { ReservationStatus, type Role } from "@metastorage/database";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/app-error";
import { getFacilityAccessScope } from "../facilities/facilities.access";
import type { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import { RESERVATION_MESSAGES } from "./reservations.messages";
import type { ReservationsRepository } from "./reservations.repository";

type ReservationActor = { id: string; role: Role | null | undefined };

function calculateRentalEndAt(startAt: string, months: number) {
  const start = new Date(startAt);
  if (start <= new Date()) throw new BadRequestError(RESERVATION_MESSAGES.futureStart);
  const vietnamOffsetMilliseconds = 7 * 60 * 60 * 1000;
  const localStart = new Date(start.getTime() + vietnamOffsetMilliseconds);
  const startDay = localStart.getUTCDate();
  localStart.setUTCDate(1);
  localStart.setUTCMonth(localStart.getUTCMonth() + months + 1, 0);
  localStart.setUTCDate(Math.min(startDay, localStart.getUTCDate()));
  return new Date(localStart.getTime() - vietnamOffsetMilliseconds);
}

export class ReservationsService {
  constructor(
    private readonly repository: ReservationsRepository,
    private readonly assignments: FacilityAssignmentsService,
  ) {}

  async create(input: CreateReservationInput, actor: ReservationActor) {
    const unitType = await this.repository.findActiveUnitType(input.facilityId, input.unitTypeId);
    if (!unitType) throw new NotFoundError(RESERVATION_MESSAGES.unitTypeNotFound);
    const rentalEndAt = calculateRentalEndAt(input.startAt, input.requestedMonths);
    const monthlyRate = unitType.monthlyPrice;
    return this.repository.create({
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

  async list(query: ReservationQuery, actor: ReservationActor) {
    if (actor.role === UserRole.STORAGE_CUSTOMER)
      return this.repository.list(query, actor.id, query.facilityId);
    const scope = getFacilityAccessScope(actor);
    const facilityId =
      query.facilityId ??
      (scope.kind === "assigned"
        ? await this.assignments.getActiveFacilityId(actor.id, scope.role)
        : undefined);
    if (facilityId) await this.assignments.requireFacilityAccess(facilityId, scope);
    return this.repository.list(query, undefined, facilityId);
  }

  async get(id: string, actor: ReservationActor) {
    const reservation = await this.repository.findById(id);
    if (!reservation) throw new NotFoundError(RESERVATION_MESSAGES.notFound);
    if (actor.role === UserRole.STORAGE_CUSTOMER) {
      if (reservation.customerId !== actor.id) throw new ForbiddenError();
    } else
      await this.assignments.requireFacilityAccess(
        reservation.facilityId,
        getFacilityAccessScope(actor),
      );
    return reservation;
  }

  async update(id: string, input: UpdateReservationInput, actor: ReservationActor) {
    const reservation = await this.get(id, actor);
    if (actor.role !== UserRole.STORAGE_CUSTOMER || reservation.customerId !== actor.id)
      throw new ForbiddenError();
    if (reservation.status !== ReservationStatus.DRAFT)
      throw new ConflictError(RESERVATION_MESSAGES.draftOnly);
    const rentalEndAt = calculateRentalEndAt(input.startAt, input.requestedMonths);
    const monthlyRate = Number(reservation.monthlyRateSnapshot);
    const result = await this.repository.updateDraft(id, actor.id, {
      rentalEndAt,
      rentalStartAt: new Date(input.startAt),
      requestedMonths: input.requestedMonths,
      rentalFeeAmount: String(monthlyRate * input.requestedMonths),
      totalAmount: String(monthlyRate * input.requestedMonths + Number(reservation.depositAmount)),
    });
    if (!result) throw new ConflictError(RESERVATION_MESSAGES.draftOnly);
    return result;
  }
}
