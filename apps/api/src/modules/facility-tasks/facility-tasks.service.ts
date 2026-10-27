import {
  type AssignFacilityTaskInput,
  type CreateFacilityTaskInput,
  type CreateFacilityTaskReportInput,
  type FacilityTaskDetail,
  type FacilityTaskListQuery,
  type FacilityTaskListResult,
  type FacilityTaskReportDetail,
  type FacilityTaskReportListQuery,
  type FacilityTaskReportListResult,
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
  FacilityTaskReportRecord,
  TaskLifecycleWriteResult,
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
    this.assertRole(actor, true);
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
    this.assertRole(actor, true);
    await this.detail(id, actor);
    return writeResult(await this.repository.assign(id, input, actor.id));
  }

  async submitReport(
    id: string,
    input: CreateFacilityTaskReportInput,
    actor: FacilityTaskActor,
  ): Promise<FacilityTaskReportDetail> {
    if (actor.role !== "FACILITY_STAFF") throw new ForbiddenError(m.accessDenied);
    await this.detail(id, actor);
    const result = await this.repository.submitReport(id, actor.id, input.content);
    if ("report" in result) return reportDetail(result.report);
    if (result.error === "TASK_NOT_FOUND") throw new NotFoundError(m.taskNotFound);
    if (result.error === "INVALID_TASK_STATE") throw new ConflictError(m.taskNotReady);
    throw new ForbiddenError(m.accessDenied);
  }

  async start(id: string, actor: FacilityTaskActor): Promise<FacilityTaskDetail> {
    if (actor.role !== "FACILITY_STAFF") throw new ForbiddenError(m.accessDenied);
    await this.detail(id, actor);
    return lifecycleResult(await this.repository.start(id, actor.id));
  }

  async acceptReport(
    id: string,
    reportId: string,
    actor: FacilityTaskActor,
  ): Promise<FacilityTaskDetail> {
    if (actor.role !== "FACILITY_MANAGER") throw new ForbiddenError(m.managerScopeRequired);
    await this.detail(id, actor);
    return lifecycleResult(await this.repository.acceptReport(id, reportId, actor.id));
  }

  async listReports(
    id: string,
    query: FacilityTaskReportListQuery,
    actor: FacilityTaskActor,
  ): Promise<FacilityTaskReportListResult> {
    await this.detail(id, actor);
    const result = await this.repository.listReports(id, query);
    return {
      items: result.items.map(reportDetail),
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  private assertRole(actor: FacilityTaskActor, managerOnly = false) {
    if (actor.role !== "FACILITY_MANAGER" && (managerOnly || actor.role !== "FACILITY_STAFF"))
      throw new ForbiddenError(managerOnly ? m.managerScopeRequired : m.accessDenied);
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
  }
}

function lifecycleResult(result: TaskLifecycleWriteResult): FacilityTaskDetail {
  if ("task" in result) return taskDetail(result.task);
  switch (result.error) {
    case "TASK_NOT_FOUND":
      throw new NotFoundError(m.taskNotFound);
    case "REPORT_NOT_FOUND":
      throw new NotFoundError(m.reportNotFound);
    case "TASK_ACCESS_DENIED":
    case "MANAGER_ACCESS_DENIED":
      throw new ForbiddenError(m.accessDenied);
    case "INVALID_TASK_STATE":
      throw new ConflictError(m.taskNotReady);
    case "REPORT_NOT_LATEST":
      throw new ConflictError(m.reportNotLatest);
  }
}

function taskDetail(task: FacilityTaskRecord): FacilityTaskDetail {
  return {
    id: task.id,
    facilityId: task.facilityId,
    type: task.type,
    status: task.status,
    title: task.title,
    description: task.description,
    storageUnitId: task.storageUnitId,
    bookingId: task.bookingId,
    assignedStaffId: task.assignedStaffId,
    assignedStaffName: task.assignedStaffName,
    createdBy: task.createdBy,
    assignedBy: task.assignedBy,
    assignerName: task.assignerName,
    version: task.version,
    startedAt: task.startedAt?.toISOString() ?? null,
    completedBy: task.completedBy,
    completedAt: task.completedAt?.toISOString() ?? null,
    assignedAt: task.assignedAt.toISOString(),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function reportDetail(report: FacilityTaskReportRecord): FacilityTaskReportDetail {
  return {
    id: report.id,
    taskId: report.taskId,
    submittedBy: report.submittedBy,
    submitterName: report.submitterName,
    content: report.content,
    submittedAt: report.submittedAt.toISOString(),
    acceptedBy: report.acceptedBy,
    acceptedByName: report.acceptedByName,
    acceptedAt: report.acceptedAt?.toISOString() ?? null,
  };
}
