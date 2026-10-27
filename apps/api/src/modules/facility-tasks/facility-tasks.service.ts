import {
  type CreateFacilityTaskInput,
  type FacilityTaskDashboardSummary,
  type FacilityTaskDetail,
  type FacilityTaskListQuery,
  type FacilityTaskListResult,
  FacilityTaskStatus,
  FacilityTaskType,
  FacilityTaskTypeReferenceSchema,
  FACILITY_TASK_MESSAGES as m,
  type StaffFacilityTaskListQuery,
  type UpdateFacilityTaskInput,
} from "@metastorage/contracts";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/app-error";
import { mapPageDto } from "../../common/types/page.dto";
import { getFacilityAccessScope } from "../facilities/facilities.access";
import type { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import type { FacilityTasksRepository } from "./facility-tasks.repository";
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
  ) {}

  async create(
    input: CreateFacilityTaskInput,
    actor: FacilityTaskActor,
  ): Promise<FacilityTaskDetail> {
    this.assertManager(actor);
    if (input.type === FacilityTaskType.CHECK_IN_HANDOVER)
      throw new BadRequestError(m.handoverTaskAutomatic);
    if (!FacilityTaskTypeReferenceSchema.safeParse(input).success)
      throw new BadRequestError(m.contextMismatch);
    await this.assignments.requireFacilityAccess(input.facilityId, getFacilityAccessScope(actor), [
      "FACILITY_MANAGER",
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

  assignBookingHandover(
    tx: TaskTransaction,
    facilityId: string,
    bookingId: string,
    staffId: string,
    managerId: string,
  ): Promise<void> {
    return this.repository.assignBookingHandover(tx, facilityId, bookingId, staffId, managerId);
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
    const facilityId = await this.assignments.getActiveFacilityId(actor.id, "FACILITY_MANAGER");
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
    if (actor.role !== "FACILITY_MANAGER") throw new ForbiddenError(m.managerScopeRequired);
  }

  private assertStaff(actor: FacilityTaskActor) {
    if (actor.role !== "FACILITY_STAFF") throw new ForbiddenError(m.accessDenied);
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
      case "TASK_ACCESS_DENIED":
        throw new ForbiddenError(m.accessDenied);
      case "TASK_TYPE_LOCKED":
        throw new BadRequestError(m.handoverTaskAutomatic);
    }
  }
}
