import type {
  CreateReservationInput,
  ReservationQuery,
  UpdateReservationInput,
} from "@metastorage/contracts";
import { ReservationStatus, type Role } from "@metastorage/database";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import { getFacilityAccessScope } from "../facilities/facilities.access";
import type { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import type { PricingService } from "../pricing/pricing.service";
import { RESERVATION_RECORD_MESSAGES as m } from "./reservations.messages";
import type { ReservationsRepository } from "./reservations.repository";

type Actor = { id: string; role: Role | null | undefined };

export class ReservationsService {
  constructor(
    private readonly repository: ReservationsRepository,
    private readonly pricing: PricingService,
    private readonly assignments: FacilityAssignmentsService,
  ) {}

  async create(input: CreateReservationInput, actor: Actor) {
    if (!(await this.repository.unitTypeAvailable(input.facilityId, input.unitTypeId)))
      throw new NotFoundError(m.unitTypeNotFound);
    const start = new Date(input.rentalStartAt);
    if (!Number.isFinite(start.getTime()) || start <= new Date())
      throw new BadRequestError(m.futureStart);
    const pricing = await this.pricing.quote(input.unitTypeId, input.requestedMonths);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + input.requestedMonths);
    return this.repository.create({
      ...input,
      customerId: actor.id,
      rentalStartAt: start,
      rentalEndAt: end,
      monthlyRateSnapshot: Number(pricing.monthlyRateSnapshot),
      rentalFeeAmount: Number(pricing.rentalFeeAmount),
      depositAmount: Number(pricing.depositAmount),
      totalAmount: Number(pricing.totalAmount),
    });
  }

  async list(query: ReservationQuery, actor: Actor) {
    if (actor.role === "CUSTOMER") return this.repository.list(query, actor.id);
    const scope = getFacilityAccessScope(actor);
    const facilityId =
      query.facilityId ??
      (scope.kind === "assigned"
        ? await this.assignments.getActiveFacilityId(actor.id, scope.role)
        : undefined);
    if (facilityId) await this.assignments.requireFacilityAccess(facilityId, scope);
    return this.repository.list({ ...query, facilityId });
  }

  async get(id: string, actor: Actor) {
    const reservation = await this.repository.get(id);
    if (!reservation) throw new NotFoundError(m.notFound);
    if (actor.role === "CUSTOMER" && reservation.customerId !== actor.id)
      throw new ForbiddenError();
    if (actor.role !== "CUSTOMER")
      await this.assignments.requireFacilityAccess(
        reservation.facilityId,
        getFacilityAccessScope(actor),
      );
    return reservation;
  }

  async update(id: string, input: UpdateReservationInput, actor: Actor) {
    const reservation = await this.get(id, actor);
    if (reservation.status !== ReservationStatus.DRAFT) throw new BadRequestError(m.draftOnly);
    const updated = await this.repository.update(id, input);
    if (!updated) throw new NotFoundError(m.notFound);
    return updated;
  }
}
