import type {
  AppointmentQuery,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "@metastorage/contracts";
import { UserRole } from "@metastorage/contracts";
import { AppointmentStatus, AppointmentType, type Role } from "@metastorage/database";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/app-error";
import { getFacilityAccessScope } from "../facilities/facilities.access";
import type { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import { APPOINTMENT_MESSAGES } from "./appointments.messages";
import type { AppointmentsRepository } from "./appointments.repository";

type AppointmentActor = { id: string; role: Role | null | undefined };

const allowedStatusTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.SCHEDULED]: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
  [AppointmentStatus.CONFIRMED]: [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.COMPLETED]: [],
  [AppointmentStatus.CANCELLED]: [],
  [AppointmentStatus.NO_SHOW]: [],
};

export class AppointmentsService {
  constructor(
    private readonly repository: AppointmentsRepository,
    private readonly assignments: FacilityAssignmentsService,
  ) {}

  async listSlots() {
    return this.repository.listSlots();
  }

  async create(input: CreateAppointmentInput, actor: AppointmentActor) {
    if (
      (input.appointmentType === AppointmentType.CHECK_IN && !input.reservationId) ||
      (input.appointmentType === AppointmentType.CHECK_OUT && !input.rentalId)
    )
      throw new BadRequestError(APPOINTMENT_MESSAGES.contextMismatch);
    const context =
      input.appointmentType === AppointmentType.CHECK_IN && input.reservationId
        ? await this.repository.findReservationContext(input.reservationId)
        : input.appointmentType === AppointmentType.CHECK_OUT && input.rentalId
          ? await this.repository.findRentalContext(input.rentalId)
          : input.supportTicketId
            ? await this.repository.findSupportTicketContext(input.supportTicketId)
            : undefined;
    if ((input.appointmentType !== AppointmentType.SUPPORT || input.supportTicketId) && !context)
      throw new NotFoundError(APPOINTMENT_MESSAGES.contextNotFound);
    const facilityId = context?.facilityId ?? input.facilityId;
    if (!facilityId) throw new BadRequestError(APPOINTMENT_MESSAGES.facilityNotFound);
    const customerId =
      context?.customerId ??
      (actor.role === UserRole.STORAGE_CUSTOMER ? actor.id : input.customerId);
    if (!customerId) throw new BadRequestError(APPOINTMENT_MESSAGES.customerNotFound);
    if (
      (input.facilityId && input.facilityId !== facilityId) ||
      (input.customerId && input.customerId !== customerId)
    )
      throw new BadRequestError(APPOINTMENT_MESSAGES.contextMismatch);
    if (actor.role === UserRole.STORAGE_CUSTOMER) {
      if (actor.id !== customerId) throw new ForbiddenError();
    } else await this.assignments.requireFacilityAccess(facilityId, getFacilityAccessScope(actor));
    if (!(await this.repository.isFacilityActive(facilityId)))
      throw new NotFoundError(APPOINTMENT_MESSAGES.facilityNotFound);
    if (!(await this.repository.isCustomerActive(customerId)))
      throw new NotFoundError(APPOINTMENT_MESSAGES.customerNotFound);
    if (!(await this.repository.slotExists(input.slotId)))
      throw new NotFoundError(APPOINTMENT_MESSAGES.slotNotFound);
    try {
      return await this.repository.create({
        facilityId,
        customerId,
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
      if (
        error instanceof Error &&
        error.cause &&
        typeof error.cause === "object" &&
        "code" in error.cause &&
        error.cause.code === "23505"
      )
        throw new ConflictError(APPOINTMENT_MESSAGES.duplicate);
      throw error;
    }
  }

  async list(query: AppointmentQuery, actor: AppointmentActor) {
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

  async get(id: string, actor: AppointmentActor) {
    const appointment = await this.repository.findById(id);
    if (!appointment) throw new NotFoundError(APPOINTMENT_MESSAGES.notFound);
    if (actor.role === UserRole.STORAGE_CUSTOMER) {
      if (appointment.customerId !== actor.id) throw new ForbiddenError();
    } else
      await this.assignments.requireFacilityAccess(
        appointment.facilityId,
        getFacilityAccessScope(actor),
      );
    return appointment;
  }

  async update(id: string, input: UpdateAppointmentInput, actor: AppointmentActor) {
    const appointment = await this.get(id, actor);
    if (!allowedStatusTransitions[appointment.status].length)
      throw new ConflictError(APPOINTMENT_MESSAGES.closed);
    if (
      actor.role === UserRole.STORAGE_CUSTOMER &&
      (input.assignedStaffId !== undefined ||
        (input.status && input.status !== AppointmentStatus.CANCELLED))
    )
      throw new ForbiddenError();
    if (
      input.status &&
      input.status !== appointment.status &&
      !allowedStatusTransitions[appointment.status].includes(input.status)
    )
      throw new ConflictError(APPOINTMENT_MESSAGES.invalidStatus);
    if (input.slotId && !(await this.repository.slotExists(input.slotId)))
      throw new NotFoundError(APPOINTMENT_MESSAGES.slotNotFound);
    if (
      input.assignedStaffId &&
      !(await this.repository.isStaffAssignedToFacility(
        input.assignedStaffId,
        appointment.facilityId,
      ))
    )
      throw new BadRequestError(APPOINTMENT_MESSAGES.invalidStaff);
    let result: Awaited<ReturnType<AppointmentsRepository["update"]>>;
    try {
      result = await this.repository.update(id, appointment.status, input);
    } catch (error) {
      if (
        error instanceof Error &&
        error.cause &&
        typeof error.cause === "object" &&
        "code" in error.cause &&
        error.cause.code === "23505"
      )
        throw new ConflictError(APPOINTMENT_MESSAGES.duplicate);
      throw error;
    }
    if (!result) throw new ConflictError(APPOINTMENT_MESSAGES.changed);
    return result;
  }
}
