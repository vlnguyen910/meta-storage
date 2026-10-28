import type {
  AppointmentQuery,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "@metastorage/contracts";
import { UserRole } from "@metastorage/contracts";
import { AppointmentStatus, AppointmentType } from "@metastorage/database";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/app-error";
import type { AuthenticatedActor } from "../auth/authenticated-actor";
import { getFacilityAccessScope } from "../facilities/facilities.access";
import type { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import { APPOINTMENT_MESSAGES } from "./appointments.messages";
import type { AppointmentsRepository } from "./appointments.repository";

const POSTGRES_UNIQUE_VIOLATION = "23505";

export class AppointmentsService {
  constructor(
    private readonly appointmentsRepository: AppointmentsRepository,
    private readonly facilityAssignmentsService: FacilityAssignmentsService,
  ) {}

  async listSlots() {
    return this.appointmentsRepository.listSlots();
  }

  async createAppointment(input: CreateAppointmentInput, customer: AuthenticatedActor) {
    if (
      (input.appointmentType === AppointmentType.CHECK_IN && !input.reservationId) ||
      (input.appointmentType === AppointmentType.CHECK_OUT && !input.rentalId)
    )
      throw new BadRequestError(APPOINTMENT_MESSAGES.contextMismatch);
    const appointmentContext =
      input.appointmentType === AppointmentType.CHECK_IN && input.reservationId
        ? await this.appointmentsRepository.findReservationContext(input.reservationId)
        : input.appointmentType === AppointmentType.CHECK_OUT && input.rentalId
          ? await this.appointmentsRepository.findRentalContext(input.rentalId)
          : input.supportTicketId
            ? await this.appointmentsRepository.findSupportTicketContext(input.supportTicketId)
            : undefined;
    if (
      (input.appointmentType !== AppointmentType.SUPPORT || input.supportTicketId) &&
      !appointmentContext
    )
      throw new NotFoundError(APPOINTMENT_MESSAGES.contextNotFound);
    const facilityId = appointmentContext?.facilityId ?? input.facilityId;
    if (!facilityId) throw new BadRequestError(APPOINTMENT_MESSAGES.facilityNotFound);
    const customerId =
      appointmentContext?.customerId ??
      (customer.role === UserRole.STORAGE_CUSTOMER ? customer.id : input.customerId);
    if (!customerId) throw new BadRequestError(APPOINTMENT_MESSAGES.customerNotFound);
    if (
      (input.facilityId && input.facilityId !== facilityId) ||
      (input.customerId && input.customerId !== customerId)
    )
      throw new BadRequestError(APPOINTMENT_MESSAGES.contextMismatch);
    if (customer.role === UserRole.STORAGE_CUSTOMER) {
      if (customer.id !== customerId) throw new ForbiddenError();
    } else
      await this.facilityAssignmentsService.requireFacilityAccess(
        facilityId,
        getFacilityAccessScope(customer),
      );
    if (!(await this.appointmentsRepository.isFacilityActive(facilityId)))
      throw new NotFoundError(APPOINTMENT_MESSAGES.facilityNotFound);
    if (!(await this.appointmentsRepository.isCustomerActive(customerId)))
      throw new NotFoundError(APPOINTMENT_MESSAGES.customerNotFound);
    if (!(await this.appointmentsRepository.slotExists(input.slotId)))
      throw new NotFoundError(APPOINTMENT_MESSAGES.slotNotFound);
    try {
      return await this.appointmentsRepository.createAppointment({
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
        createdBy: customer.id,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.cause &&
        typeof error.cause === "object" &&
        "code" in error.cause &&
        error.cause.code === POSTGRES_UNIQUE_VIOLATION
      )
        throw new ConflictError(APPOINTMENT_MESSAGES.duplicate);
      throw error;
    }
  }

  async listAppointments(query: AppointmentQuery, actor: AuthenticatedActor) {
    if (actor.role === UserRole.STORAGE_CUSTOMER)
      return this.appointmentsRepository.listAppointments(
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
    return this.appointmentsRepository.listAppointments(query, undefined, facilityId);
  }

  async getAppointment(appointmentId: string, user: AuthenticatedActor) {
    const appointment = await this.appointmentsRepository.findAppointmentById(appointmentId);
    if (!appointment) throw new NotFoundError(APPOINTMENT_MESSAGES.notFound);
    if (user.role === UserRole.STORAGE_CUSTOMER) {
      if (appointment.customerId !== user.id || appointment.createdBy !== user.id)
        throw new ForbiddenError();
    } else
      await this.facilityAssignmentsService.requireFacilityAccess(
        appointment.facilityId,
        getFacilityAccessScope(user),
      );
    return appointment;
  }

  async updateAppointment(
    appointmentId: string,
    input: UpdateAppointmentInput,
    user: AuthenticatedActor,
  ) {
    const appointment = await this.getAppointment(appointmentId, user);
    if (
      user.role === UserRole.STORAGE_CUSTOMER &&
      (input.assignedStaffId !== undefined ||
        (input.status && input.status !== AppointmentStatus.CANCELLED))
    )
      throw new ForbiddenError();
    if (input.slotId && !(await this.appointmentsRepository.slotExists(input.slotId)))
      throw new NotFoundError(APPOINTMENT_MESSAGES.slotNotFound);
    if (
      input.assignedStaffId &&
      !(await this.appointmentsRepository.isStaffAssignedToFacility(
        input.assignedStaffId,
        appointment.facilityId,
      ))
    )
      throw new BadRequestError(APPOINTMENT_MESSAGES.invalidStaff);
    let updatedAppointment: Awaited<ReturnType<AppointmentsRepository["updateAppointment"]>>;
    try {
      updatedAppointment = await this.appointmentsRepository.updateAppointment(
        appointmentId,
        input,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.cause &&
        typeof error.cause === "object" &&
        "code" in error.cause &&
        error.cause.code === POSTGRES_UNIQUE_VIOLATION
      )
        throw new ConflictError(APPOINTMENT_MESSAGES.duplicate);
      throw error;
    }
    if (!updatedAppointment) throw new NotFoundError(APPOINTMENT_MESSAGES.notFound);
    return updatedAppointment;
  }
}
