import {
  type AssignFacilityTaskInput,
  type CreateFacilityTaskInput,
  type FacilityTaskDetail,
  type FacilityTaskListQuery,
  type FacilityTaskListResult,
  FacilityTaskReferenceType,
  FacilityTaskType,
  FACILITY_TASK_MESSAGES as m,
} from "@metastorage/contracts";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/app-error";
import { getFacilityAccessScope, requireAssignedFacility } from "../facilities/facilities.access";
import type { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import type { FacilityTasksRepository } from "./facility-tasks.repository";
import type {
  FacilityTaskActor,
  FacilityTaskRecord,
  TaskWriteResult,
} from "./facility-tasks.types";

export class FacilityTasksService {
  constructor(
    private readonly repository: FacilityTasksRepository,
    private readonly assignments: FacilityAssignmentsRepository,
  ) {}

  async create(
    input: CreateFacilityTaskInput,
    actor: FacilityTaskActor,
  ): Promise<FacilityTaskDetail> {
    this.assertManager(actor);
    if (input.type === FacilityTaskType.CHECK_IN_HANDOVER)
      throw new BadRequestError(m.handoverTaskAutomatic);
    if (
      (input.type === FacilityTaskType.UNIT_INSPECTION &&
        input.referenceType === FacilityTaskReferenceType.SUPPORT_TICKET) ||
      (input.type === FacilityTaskType.HANDLE_SUPPORT &&
        input.referenceType !== FacilityTaskReferenceType.SUPPORT_TICKET)
    )
      throw new BadRequestError(m.contextMismatch);
    await requireAssignedFacility(
      this.assignments,
      input.facilityId,
      getFacilityAccessScope(actor),
      ["FACILITY_MANAGER"],
    );
    return writeResult(await this.repository.create(input, actor.id));
  }

  async list(
    query: FacilityTaskListQuery,
    actor: FacilityTaskActor,
  ): Promise<FacilityTaskListResult> {
    this.assertRole(actor);
    await requireAssignedFacility(
      this.assignments,
      query.facilityId,
      getFacilityAccessScope(actor),
      ["FACILITY_MANAGER", "FACILITY_STAFF"],
    );
    if (
      actor.role === "FACILITY_STAFF" &&
      query.assignedStaffId &&
      query.assignedStaffId !== actor.id
    )
      throw new ForbiddenError(m.accessDenied);
    const result = await this.repository.list({
      ...query,
      assignedStaffId: actor.role === "FACILITY_STAFF" ? actor.id : query.assignedStaffId,
    });
    return {
      items: result.items.map(taskDetail),
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async detail(id: string, actor: FacilityTaskActor): Promise<FacilityTaskDetail> {
    this.assertRole(actor);
    const task = await this.repository.findById(id);
    if (!task) throw new NotFoundError(m.taskNotFound);
    await requireAssignedFacility(
      this.assignments,
      task.facilityId,
      getFacilityAccessScope(actor),
      ["FACILITY_MANAGER", "FACILITY_STAFF"],
    );
    if (actor.role === "FACILITY_STAFF" && task.assignedStaffId !== actor.id)
      throw new ForbiddenError(m.accessDenied);
    return taskDetail(task);
  }

  async assign(
    id: string,
    input: AssignFacilityTaskInput,
    actor: FacilityTaskActor,
  ): Promise<FacilityTaskDetail> {
    this.assertManager(actor);
    await this.detail(id, actor);
    return writeResult(await this.repository.assign(id, input, actor.id));
  }

  async start(id: string, actor: FacilityTaskActor): Promise<FacilityTaskDetail> {
    if (actor.role !== "FACILITY_STAFF") throw new ForbiddenError(m.accessDenied);
    await this.detail(id, actor);
    return writeResult(await this.repository.start(id, actor.id));
  }

  async complete(id: string, actor: FacilityTaskActor): Promise<FacilityTaskDetail> {
    if (actor.role !== "FACILITY_STAFF") throw new ForbiddenError(m.accessDenied);
    await this.detail(id, actor);
    return writeResult(await this.repository.complete(id, actor.id));
  }

  async cancel(id: string, actor: FacilityTaskActor): Promise<FacilityTaskDetail> {
    this.assertManager(actor);
    await this.detail(id, actor);
    return writeResult(await this.repository.cancel(id, actor.id));
  }

  private assertManager(actor: FacilityTaskActor) {
    if (actor.role !== "FACILITY_MANAGER") throw new ForbiddenError(m.managerScopeRequired);
  }

  private assertRole(actor: FacilityTaskActor) {
    if (actor.role !== "FACILITY_MANAGER" && actor.role !== "FACILITY_STAFF")
      throw new ForbiddenError(m.accessDenied);
  }
}

function writeResult(result: TaskWriteResult): FacilityTaskDetail {
  if ("task" in result) return taskDetail(result.task);
  switch (result.error) {
    case "TASK_NOT_FOUND":
      throw new NotFoundError(m.taskNotFound);
    case "MANAGER_ACCESS_DENIED":
      throw new ForbiddenError(m.managerScopeRequired);
    case "STAFF_UNAVAILABLE":
      throw new BadRequestError(m.staffUnavailable);
    case "CONTEXT_MISMATCH":
      throw new BadRequestError(m.contextMismatch);
    case "VERSION_CONFLICT":
      throw new ConflictError(m.versionConflict);
    case "INVALID_TASK_STATE":
      throw new ConflictError(m.taskNotReady);
    case "TASK_ACCESS_DENIED":
      throw new ForbiddenError(m.accessDenied);
  }
}

function taskDetail(task: FacilityTaskRecord): FacilityTaskDetail {
  return {
    id: task.id,
    facilityId: task.facilityId,
    type: task.type,
    status: task.status,
    referenceType: task.referenceType,
    referenceId: task.referenceId,
    assignedStaffId: task.assignedStaffId,
    assignedStaffName: task.assignedStaffName,
    assignedBy: task.assignedBy,
    assignerName: task.assignerName,
    version: task.version,
    startedAt: task.startedAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    assignedAt: task.assignedAt.toISOString(),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
