import type {
  AppointmentQuery,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "@metastorage/contracts";
import { APPOINTMENT_STATUSES, type Role } from "@metastorage/database";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/app-error";
import { getFacilityAccessScope } from "../facilities/facilities.access";
import type { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import { APPOINTMENT_MESSAGES as m } from "./appointments.messages";
import type { AppointmentsRepository } from "./appointments.repository";

type Actor = { id: string; role: Role | null | undefined };
const transitions: Partial<Record<APPOINTMENT_STATUSES, readonly APPOINTMENT_STATUSES[]>> = {
  [APPOINTMENT_STATUSES.SCHEDULED]: [
    APPOINTMENT_STATUSES.CONFIRMED,
    APPOINTMENT_STATUSES.CANCELLED,
  ],
  [APPOINTMENT_STATUSES.CONFIRMED]: [
    APPOINTMENT_STATUSES.COMPLETED,
    APPOINTMENT_STATUSES.CANCELLED,
    APPOINTMENT_STATUSES.NO_SHOW,
  ],
};

export class AppointmentsService {
  constructor(
    private readonly repository: AppointmentsRepository,
    private readonly assignments: FacilityAssignmentsService,
  ) {}

  async create(input: CreateAppointmentInput, actor: Actor) {
    let context: { facilityId: string; customerId: string } | undefined;
    if (input.appointmentType === "CHECK_IN" && input.reservationId) {
      const row = await this.repository.reservationContext(input.reservationId);
      if (!row || !["DRAFT", "CONFIRMED"].includes(row.status))
        throw new NotFoundError(m.contextNotFound);
      context = row;
    } else if (input.appointmentType === "CHECK_OUT" && input.rentalId) {
      const row = await this.repository.rentalContext(input.rentalId);
      if (row?.status !== "ACTIVE") throw new NotFoundError(m.contextNotFound);
      context = row;
    } else if (input.supportTicketId) {
      const support = await this.repository.supportContext(input.supportTicketId);
      if (!support) throw new NotFoundError(m.contextNotFound);
      context = support;
    }

    if (context && context.customerId !== actor.id) throw new ForbiddenError();
    if (context && input.facilityId && input.facilityId !== context.facilityId)
      throw new BadRequestError(m.contextMismatch);
    const facilityId = context?.facilityId ?? input.facilityId;
    if (!facilityId) throw new BadRequestError(m.contextMismatch);
    if (!(await this.repository.isFacilityActive(facilityId)))
      throw new NotFoundError(m.contextNotFound);
    if (!(await this.repository.slotExists(input.slotId))) throw new NotFoundError(m.slotNotFound);

    try {
      return await this.repository.create({
        facilityId,
        customerId: context?.customerId ?? actor.id,
        appointmentType: input.appointmentType,
        scheduledDate: input.scheduledDate,
        slotId: input.slotId,
        contactPhone: input.contactPhone,
        notes: input.notes,
        reservationId: input.reservationId,
        rentalId: input.rentalId,
        supportTicketId: input.supportTicketId,
        createdBy: actor.id,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError(m.duplicate);
      throw error;
    }
  }

  async list(query: AppointmentQuery, actor: Actor) {
    if (actor.role === "CUSTOMER") return this.repository.list(query, actor.id);
    if (actor.role === "FACILITY_STAFF") {
      const scope = getFacilityAccessScope(actor);
      const facilityId =
        query.facilityId ??
        (await this.assignments.getActiveFacilityId(actor.id, "FACILITY_STAFF"));
      await this.assignments.requireFacilityAccess(facilityId, scope, ["FACILITY_STAFF"]);
      return this.repository.list(query, undefined, facilityId, actor.id);
    }
    const scope = getFacilityAccessScope(actor);
    const facilityId =
      query.facilityId ??
      (scope.kind === "assigned"
        ? await this.assignments.getActiveFacilityId(actor.id, scope.role)
        : undefined);
    if (facilityId) await this.assignments.requireFacilityAccess(facilityId, scope);
    return this.repository.list(query, undefined, facilityId);
  }

  async get(id: string, actor: Actor) {
    const appointment = await this.repository.findById(id);
    if (!appointment) throw new NotFoundError(m.notFound);
    if (actor.role === "CUSTOMER") {
      if (appointment.customerId !== actor.id) throw new ForbiddenError();
    } else if (actor.role === "FACILITY_STAFF") {
      if (appointment.assignedStaffId !== actor.id) throw new ForbiddenError();
      await this.assignments.requireFacilityAccess(
        appointment.facilityId,
        getFacilityAccessScope(actor),
        ["FACILITY_STAFF"],
      );
    } else {
      await this.assignments.requireFacilityAccess(
        appointment.facilityId,
        getFacilityAccessScope(actor),
      );
    }
    return appointment;
  }

  async update(id: string, input: UpdateAppointmentInput, actor: Actor) {
    const appointment = await this.get(id, actor);
    const isCustomer = actor.role === "CUSTOMER";
    const isStaff = actor.role === "FACILITY_STAFF";
    if (
      isCustomer &&
      (Object.keys(input).some((key) => key !== "status") || input.status !== "CANCELLED")
    )
      throw new ForbiddenError();
    if (
      isStaff &&
      (Object.keys(input).some((key) => key !== "status") ||
        !["COMPLETED", "NO_SHOW"].includes(input.status ?? ""))
    )
      throw new ForbiddenError();
    if (
      input.assignedStaffId &&
      !(await this.repository.staffAssigned(appointment.facilityId, input.assignedStaffId))
    )
      throw new BadRequestError(m.staffInvalid);
    if (input.status && !transitions[appointment.status]?.includes(input.status))
      throw new ConflictError(m.transitionInvalid);
    try {
      const updated = await this.repository.update(id, input, appointment.status);
      if (!updated) throw new ConflictError(m.transitionInvalid);
      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError(m.duplicate);
      throw error;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "cause" in error &&
    !!error.cause &&
    typeof error.cause === "object" &&
    "code" in error.cause &&
    error.cause.code === "23505"
  );
}
