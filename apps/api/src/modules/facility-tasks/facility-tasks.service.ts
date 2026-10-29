import {
  type CreateFacilityTaskInput,
  type FacilityTaskDashboardSummary,
  type FacilityTaskDetail,
  type FacilityTaskListQuery,
  type FacilityTaskListResult,
  FacilityTaskReferenceType,
  FacilityTaskStatus,
  FacilityTaskType,
  FacilityTaskTypeReferenceSchema,
  FACILITY_TASK_MESSAGES as m,
  type StaffFacilityTaskListQuery,
  type UpdateFacilityTaskInput,
} from "@metastorage/contracts";
import type { AppointmentRecord, Database } from "@metastorage/database";
import { UserRole } from "@metastorage/database/schema/user-enums";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/app-error";
import { mapPageDto } from "../../common/types/page.dto";
import { isDevelopmentEnvironment } from "../../config/env";
import { CheckInSlotsRepository } from "../appointments/check-in-slots.repository";
import { CheckInSlotsService } from "../appointments/check-in-slots.service";
import { getFacilityAccessScope } from "../facilities/facilities.access";
import { FacilitiesRepository } from "../facilities/facilities.repository";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import { FacilityTasksRepository } from "./facility-tasks.repository";
import type {
  FacilityTaskActor,
  FacilityTaskRecord,
  TaskTransaction,
  TaskWriteResult,
} from "./facility-tasks.types";
export class FacilityTasksService {
  constructor(
    private readonly repository: FacilityTasksRepository,
    private readonly assignments: FacilityAssignmentsService,
    private readonly appointmentSlots?: CheckInSlotsService,
  ) {}

  async assignAppointment(tx: TaskTransaction, appointment: AppointmentRecord, managerId: string) {
    if (!appointment.assignedStaffId) throw new BadRequestError(m.staffUnavailable);
    await this.assignments.requireActiveAssignments(tx, appointment.facilityId, [
      { userId: managerId, role: UserRole.FACILITY_MANAGER },
      { userId: appointment.assignedStaffId, role: UserRole.FACILITY_STAFF },
    ]);
    const [task] = await this.repository.findActiveAppointmentTask(tx, appointment.id);
    if (task) {
      if (task.assignedStaffId === appointment.assignedStaffId) return;
      if (task.status === FacilityTaskStatus.IN_PROGRESS) throw new ConflictError(m.taskNotReady);
      await this.repository.reassignTask(
        tx,
        task.id,
        appointment.assignedStaffId,
        managerId,
        new Date(),
      );
      return;
    }
    await this.repository.createAppointmentTask(tx, {
      facilityId: appointment.facilityId,
      type:
        appointment.appointmentType === "CHECK_IN"
          ? FacilityTaskType.CHECK_IN_HANDOVER
          : appointment.appointmentType === "CHECK_OUT"
            ? FacilityTaskType.UNIT_INSPECTION
            : FacilityTaskType.HANDLE_SUPPORT,
      referenceType: FacilityTaskReferenceType.APPOINTMENT,
      referenceId: appointment.id,
      assignedStaffId: appointment.assignedStaffId,
      assignedBy: managerId,
    });
  }

  async finishAppointment(
    tx: TaskTransaction,
    appointmentId: string,
    completed: boolean,
    actorId: string,
  ) {
    const [task] = await this.repository.findActiveAppointmentTask(tx, appointmentId);
    if (
      completed &&
      (!task || task.status !== FacilityTaskStatus.IN_PROGRESS || task.assignedStaffId !== actorId)
    )
      throw new ConflictError(m.taskNotReady);
    if (task)
      await this.repository.setWorkflowStatus(
        tx,
        task.id,
        completed ? FacilityTaskStatus.COMPLETED : FacilityTaskStatus.CANCELLED,
        { ...(completed ? { completedAt: new Date() } : {}), updatedAt: new Date() },
      );
  }

  async create(
    input: CreateFacilityTaskInput,
    actor: FacilityTaskActor,
  ): Promise<FacilityTaskDetail> {
    this.assertManager(actor);
    if (
      [FacilityTaskReferenceType.APPOINTMENT, FacilityTaskReferenceType.BOOKING].includes(
        input.referenceType,
      )
    )
      throw new BadRequestError(m.appointmentWorkflowRequired);
    if (input.type === FacilityTaskType.CHECK_IN_HANDOVER)
      throw new BadRequestError(m.handoverTaskAutomatic);
    if (!FacilityTaskTypeReferenceSchema.safeParse(input).success)
      throw new BadRequestError(m.contextMismatch);
    await this.assignments.requireFacilityAccess(input.facilityId, getFacilityAccessScope(actor), [
      UserRole.FACILITY_MANAGER,
    ]);
    const task = await this.write(this.repository.create(input, actor));
    return {
      ...task,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      assignedAt: task.assignedAt.toISOString(),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  async listMineTask(
    query: StaffFacilityTaskListQuery,
    actor: FacilityTaskActor,
  ): Promise<FacilityTaskListResult> {
    this.assertStaff(actor);
    const assignments = await this.assignments.listUserAssignments(actor.id, actor.role);
    if (!assignments.length) throw new ForbiddenError(m.accessDenied);
    const result = await this.repository.listForStaff(
      actor.id,
      assignments.map(({ facilityId }) => facilityId),
      query,
    );
    return mapPageDto(result, query, (task) => ({
      ...task,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      assignedAt: task.assignedAt.toISOString(),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }));
  }

  async listFacility(
    query: FacilityTaskListQuery,
    actor: FacilityTaskActor,
  ): Promise<FacilityTaskListResult> {
    this.assertManager(actor);
    const facilityId = await this.assignments.getActiveFacilityId(
      actor.id,
      UserRole.FACILITY_MANAGER,
    );
    const result = await this.repository.listForFacility(facilityId, query);
    return mapPageDto(result, query, (task) => ({
      ...task,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      assignedAt: task.assignedAt.toISOString(),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }));
  }

  async dashboardForStaff(actor: FacilityTaskActor): Promise<FacilityTaskDashboardSummary> {
    this.assertStaff(actor);
    const assignments = await this.assignments.listUserAssignments(actor.id, actor.role);
    if (!assignments.length) throw new ForbiddenError(m.accessDenied);
    return this.repository.dashboardForStaff(
      actor.id,
      assignments.map(({ facilityId }) => facilityId),
    );
  }

  async update(
    id: string,
    input: UpdateFacilityTaskInput,
    actor: FacilityTaskActor,
  ): Promise<FacilityTaskDetail> {
    const [current] = await this.repository.findById(id);
    if (current?.referenceType === FacilityTaskReferenceType.BOOKING)
      throw new ConflictError(m.appointmentWorkflowRequired);
    if (current?.referenceType === FacilityTaskReferenceType.APPOINTMENT) {
      // Appointment owns assignment and terminal states so both records commit together.
      if (!("status" in input) || input.status !== FacilityTaskStatus.IN_PROGRESS)
        throw new ConflictError(m.appointmentWorkflowRequired);
      const appointment = await this.repository.findAppointment(current.referenceId);
      const slot =
        appointment &&
        (await this.appointmentSlots?.findByIdForDate(
          appointment.slotId,
          appointment.scheduledDate,
        ));
      if (appointment?.status !== "CONFIRMED") throw new ConflictError(m.appointmentNotConfirmed);
      if (!slot) throw new ConflictError(m.appointmentSlotUnavailable);
      const now = new Date();
      const developmentMode = isDevelopmentEnvironment();
      if (!developmentMode && now < slot.startsAt) throw new ConflictError(m.appointmentNotStarted);
      if (
        !developmentMode &&
        now >=
          (appointment.appointmentType === "CHECK_OUT"
            ? new Date(`${appointment.scheduledDate}T23:59:59.999+07:00`)
            : slot.endsAt)
      )
        throw new ConflictError(m.appointmentWindowClosed);
    }
    if ("status" in input) {
      if (input.status === FacilityTaskStatus.CANCELLED) this.assertManager(actor);
      else this.assertStaff(actor);
    } else {
      this.assertManager(actor);
      if (input.type) this.assertTypeCanBeAssigned(input.type);
    }
    const task = await this.write(this.repository.update(id, input, actor));
    return {
      ...task,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      assignedAt: task.assignedAt.toISOString(),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  private assertManager(actor: FacilityTaskActor) {
    if (actor.role !== UserRole.FACILITY_MANAGER) throw new ForbiddenError(m.managerScopeRequired);
  }

  private assertStaff(actor: FacilityTaskActor) {
    if (actor.role !== UserRole.FACILITY_STAFF) throw new ForbiddenError(m.accessDenied);
  }

  private assertTypeCanBeAssigned(type: FacilityTaskType) {
    if (type === FacilityTaskType.CHECK_IN_HANDOVER)
      throw new BadRequestError(m.handoverTaskAutomatic);
  }

  private async write(result: Promise<TaskWriteResult>): Promise<FacilityTaskRecord> {
    const value = await result;
    if ("task" in value) return value.task;
    switch (value.error) {
      case "TASK_NOT_FOUND":
        throw new NotFoundError(m.taskNotFound);
      case "MANAGER_ACCESS_DENIED":
        throw new ForbiddenError(m.managerScopeRequired);
      case "STAFF_UNAVAILABLE":
        throw new BadRequestError(m.staffUnavailable);
      case "CONTEXT_MISMATCH":
        throw new BadRequestError(m.contextMismatch);
      case "INVALID_TASK_STATE":
        throw new ConflictError(m.taskNotReady);
      case "INVALID_STATUS_TRANSITION":
        throw new ConflictError(m.taskStatusTransitionInvalid);
      case "TASK_ACCESS_DENIED":
        throw new ForbiddenError(m.accessDenied);
      case "TASK_TYPE_LOCKED":
        throw new BadRequestError(m.handoverTaskAutomatic);
    }
  }
}

export function createFacilityTasksService(db: Database) {
  const assignments = new FacilityAssignmentsRepository(db);
  return new FacilityTasksService(
    new FacilityTasksRepository(db, assignments),
    new FacilityAssignmentsService(assignments, new FacilitiesRepository(db)),
    new CheckInSlotsService(new CheckInSlotsRepository(db)),
  );
}
