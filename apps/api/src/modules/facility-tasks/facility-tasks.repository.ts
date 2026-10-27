import { randomUUID } from "node:crypto";
import {
  type AssignFacilityTaskInput,
  type CreateFacilityTaskInput,
  FACILITY_TASK_MESSAGES,
  type FacilityTaskListQuery,
  type FacilityTaskReportListQuery,
} from "@metastorage/contracts";
import {
  aliasedTable,
  and,
  bookings,
  count,
  type Database,
  desc,
  eq,
  facilityAssignments,
  facilityTasks,
  getTableColumns,
  gt,
  inArray,
  isNull,
  or,
  storageUnits,
  users,
} from "@metastorage/database";
import type {
  FacilityTaskRecord,
  FacilityTaskReportRecord,
  LockedTaskActors,
  TaskLifecycleWriteResult,
  TaskReportWriteResult,
  TaskTransaction,
  TaskWriteResult,
} from "./facility-tasks.types";

const assignee = aliasedTable(users, "task_assignee");
const assigner = aliasedTable(users, "task_assigner");
const reportSubmitter = aliasedTable(users, "report_submitter");
const reportAcceptor = aliasedTable(users, "report_acceptor");
const columns = {
  ...getTableColumns(facilityTasks),
  assignedStaffName: assignee.name,
  assignerName: assigner.name,
};

export class FacilityTasksRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<FacilityTaskRecord | undefined> {
    const [task] = await this.db
      .select(columns)
      .from(facilityTasks)
      .innerJoin(assignee, eq(assignee.id, facilityTasks.assignedStaffId))
      .innerJoin(assigner, eq(assigner.id, facilityTasks.assignedBy))
      .where(eq(facilityTasks.id, id));
    return task;
  }

  async list(query: FacilityTaskListQuery) {
    const filter = and(
      eq(facilityTasks.facilityId, query.facilityId),
      query.assignedStaffId ? eq(facilityTasks.assignedStaffId, query.assignedStaffId) : undefined,
      query.type ? eq(facilityTasks.type, query.type) : undefined,
    );
    return this.db.transaction(
      async (tx) => {
        const [total] = await tx.select({ value: count() }).from(facilityTasks).where(filter);
        const items = await tx
          .select(columns)
          .from(facilityTasks)
          .innerJoin(assignee, eq(assignee.id, facilityTasks.assignedStaffId))
          .innerJoin(assigner, eq(assigner.id, facilityTasks.assignedBy))
          .where(filter)
          .orderBy(desc(facilityTasks.createdAt), desc(facilityTasks.id))
          .limit(query.limit)
          .offset(query.offset);
        return { items, total: total?.value ?? 0 };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async submitReport(id: string, staffId: string, content: string): Promise<TaskReportWriteResult> {
    return this.db.transaction(async (tx) => {
      // Same task -> account -> membership lock order as reassignment. Recheck
      // ownership while locked so a previous assignee cannot write after reassignment.
      const [task] = await tx
        .select()
        .from(facilityTasks)
        .where(eq(facilityTasks.id, id))
        .for("update");
      if (!task) return { error: "TASK_NOT_FOUND" };
      if (task.assignedStaffId !== staffId) return { error: "REPORT_ACCESS_DENIED" };
      if (task.status !== "IN_PROGRESS" && task.status !== "AWAITING_APPROVAL")
        return { error: "INVALID_TASK_STATE" };
      const [staff] = await tx
        .select({ id: users.id, name: users.name, role: users.role, status: users.status })
        .from(users)
        .where(eq(users.id, staffId))
        .for("update");
      if (staff?.role !== "FACILITY_STAFF" || staff.status !== "ACTIVE")
        return { error: "REPORT_ACCESS_DENIED" };
      const [assignment] = await tx
        .select()
        .from(facilityAssignments)
        .where(
          and(
            eq(facilityAssignments.userId, staffId),
            eq(facilityAssignments.facilityId, task.facilityId),
            eq(facilityAssignments.role, "FACILITY_STAFF"),
            eq(facilityAssignments.isActive, true),
            or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
          ),
        )
        .for("update");
      if (!assignment) return { error: "REPORT_ACCESS_DENIED" };
      const now = new Date();
      const [taskWithReport] = await tx
        .update(facilityTasks)
        .set({
          status: "AWAITING_APPROVAL",
          reportId: randomUUID(),
          reportContent: content,
          reportSubmittedBy: staffId,
          reportSubmittedAt: now,
          updatedAt: now,
        })
        .where(eq(facilityTasks.id, id))
        .returning();
      if (!taskWithReport) throw new Error(FACILITY_TASK_MESSAGES.reportPersistenceFailed);
      if (
        !taskWithReport.reportId ||
        !taskWithReport.reportSubmittedBy ||
        !taskWithReport.reportContent ||
        !taskWithReport.reportSubmittedAt
      )
        throw new Error(FACILITY_TASK_MESSAGES.reportPersistenceFailed);
      return {
        report: {
          id: taskWithReport.reportId,
          taskId: taskWithReport.id,
          submittedBy: taskWithReport.reportSubmittedBy,
          submitterName: staff.name,
          content: taskWithReport.reportContent,
          submittedAt: taskWithReport.reportSubmittedAt,
          acceptedBy: null,
          acceptedByName: null,
          acceptedAt: null,
        },
      };
    });
  }

  async start(id: string, staffId: string): Promise<TaskLifecycleWriteResult> {
    return this.db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(facilityTasks)
        .where(eq(facilityTasks.id, id))
        .for("update");
      if (!task) return { error: "TASK_NOT_FOUND" };
      if (task.assignedStaffId !== staffId) return { error: "TASK_ACCESS_DENIED" };
      if (task.status !== "ASSIGNED") return { error: "INVALID_TASK_STATE" };
      const [staff] = await tx
        .select({ id: users.id, role: users.role, status: users.status })
        .from(users)
        .where(eq(users.id, staffId))
        .for("update");
      if (staff?.role !== "FACILITY_STAFF" || staff.status !== "ACTIVE")
        return { error: "TASK_ACCESS_DENIED" };
      const [assignment] = await tx
        .select({ userId: facilityAssignments.userId })
        .from(facilityAssignments)
        .where(
          and(
            eq(facilityAssignments.userId, staffId),
            eq(facilityAssignments.facilityId, task.facilityId),
            eq(facilityAssignments.role, "FACILITY_STAFF"),
            eq(facilityAssignments.isActive, true),
            or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
          ),
        )
        .for("update");
      if (!assignment) return { error: "TASK_ACCESS_DENIED" };
      const now = new Date();
      await tx
        .update(facilityTasks)
        .set({ status: "IN_PROGRESS", startedAt: now, updatedAt: now })
        .where(eq(facilityTasks.id, id));
      const updated = await loadTaskRecord(tx, id);
      if (!updated) throw new Error(FACILITY_TASK_MESSAGES.persistenceFailed);
      return { task: updated };
    });
  }

  async acceptReport(
    id: string,
    reportId: string,
    managerId: string,
  ): Promise<TaskLifecycleWriteResult> {
    return this.db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(facilityTasks)
        .where(eq(facilityTasks.id, id))
        .for("update");
      if (!task) return { error: "TASK_NOT_FOUND" };
      if (task.status !== "AWAITING_APPROVAL") return { error: "INVALID_TASK_STATE" };
      if (!(await lockManagerAssignment(tx, task.facilityId, managerId)))
        return { error: "MANAGER_ACCESS_DENIED" };
      if (!task.reportId) return { error: "REPORT_NOT_FOUND" };
      if (task.reportId !== reportId) return { error: "REPORT_NOT_LATEST" };
      const now = new Date();
      await tx
        .update(facilityTasks)
        .set({ status: "COMPLETED", completedBy: managerId, completedAt: now, updatedAt: now })
        .where(eq(facilityTasks.id, id));
      const updated = await loadTaskRecord(tx, id);
      if (!updated) throw new Error(FACILITY_TASK_MESSAGES.persistenceFailed);
      return { task: updated };
    });
  }

  async listReports(id: string, query: FacilityTaskReportListQuery) {
    const [row] = await this.db
      .select({
        id: facilityTasks.reportId,
        taskId: facilityTasks.id,
        submittedBy: facilityTasks.reportSubmittedBy,
        submitterName: reportSubmitter.name,
        content: facilityTasks.reportContent,
        submittedAt: facilityTasks.reportSubmittedAt,
        acceptedBy: facilityTasks.completedBy,
        acceptedByName: reportAcceptor.name,
        acceptedAt: facilityTasks.completedAt,
      })
      .from(facilityTasks)
      .leftJoin(reportSubmitter, eq(reportSubmitter.id, facilityTasks.reportSubmittedBy))
      .leftJoin(reportAcceptor, eq(reportAcceptor.id, facilityTasks.completedBy))
      .where(eq(facilityTasks.id, id));
    if (!row?.id || !row.content || !row.submittedBy || !row.submittedAt || !row.submitterName)
      return { items: [], total: 0 };
    const report: FacilityTaskReportRecord = {
      id: row.id,
      taskId: row.taskId,
      submittedBy: row.submittedBy,
      submitterName: row.submitterName,
      content: row.content,
      submittedAt: row.submittedAt,
      acceptedBy: row.acceptedBy,
      acceptedByName: row.acceptedByName,
      acceptedAt: row.acceptedAt,
    };
    return {
      items: query.offset === 0 && query.limit > 0 ? [report] : [],
      total: 1,
    };
  }

  async create(input: CreateFacilityTaskInput, managerId: string): Promise<TaskWriteResult> {
    return this.db.transaction(async (tx) => {
      const actors = await lockTaskActors(tx, input.facilityId, managerId, input.assignedStaffId);
      if ("error" in actors) return actors;
      // Match the existing booking-before-unit lock order for optional operational context.
      if (input.bookingId) {
        const [booking] = await tx
          .select({ facilityId: bookings.facilityId })
          .from(bookings)
          .where(eq(bookings.id, input.bookingId))
          .for("update");
        if (booking?.facilityId !== input.facilityId) return { error: "CONTEXT_MISMATCH" };
      }
      if (input.storageUnitId) {
        const [unit] = await tx
          .select({ facilityId: storageUnits.facilityId })
          .from(storageUnits)
          .where(eq(storageUnits.id, input.storageUnitId))
          .for("update");
        if (unit?.facilityId !== input.facilityId) return { error: "CONTEXT_MISMATCH" };
      }
      const [task] = await tx
        .insert(facilityTasks)
        .values({
          facilityId: input.facilityId,
          assignedStaffId: input.assignedStaffId,
          type: input.type,
          title: input.title,
          description: input.description ?? null,
          storageUnitId: input.storageUnitId ?? null,
          bookingId: input.bookingId ?? null,
          createdBy: managerId,
          assignedBy: managerId,
        })
        .returning();
      if (!task) throw new Error(FACILITY_TASK_MESSAGES.persistenceFailed);
      return {
        task: { ...task, assignedStaffName: actors.staff.name, assignerName: actors.manager.name },
      };
    });
  }

  async assign(
    id: string,
    input: AssignFacilityTaskInput,
    managerId: string,
  ): Promise<TaskWriteResult> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(facilityTasks)
        .where(eq(facilityTasks.id, id))
        .for("update");
      if (!current) return { error: "TASK_NOT_FOUND" };
      if (current.status === "COMPLETED") return { error: "INVALID_TASK_STATE" };
      const actors = await lockTaskActors(tx, current.facilityId, managerId, input.assignedStaffId);
      if ("error" in actors) return actors;
      if (current.version !== input.version) return { error: "VERSION_CONFLICT" };
      if (current.assignedStaffId === input.assignedStaffId) {
        // Preserve the previous assignment actor and time for a same-assignee retry.
        const [previousAssigner] = await tx
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, current.assignedBy));
        return {
          task: {
            ...current,
            assignedStaffName: actors.staff.name,
            assignerName: previousAssigner?.name ?? actors.manager.name,
          },
        };
      }
      const now = new Date();
      const [task] = await tx
        .update(facilityTasks)
        .set({
          assignedStaffId: input.assignedStaffId,
          assignedBy: managerId,
          assignedAt: now,
          updatedAt: now,
          version: current.version + 1,
        })
        .where(and(eq(facilityTasks.id, id), eq(facilityTasks.version, input.version)))
        .returning();
      if (!task) return { error: "VERSION_CONFLICT" };
      return {
        task: { ...task, assignedStaffName: actors.staff.name, assignerName: actors.manager.name },
      };
    });
  }
}

async function lockTaskActors(
  tx: TaskTransaction,
  facilityId: string,
  managerId: string,
  staffId: string,
): Promise<LockedTaskActors> {
  // Match facility-assignment changes: lock users first, then memberships, in stable ID order.
  const people = await tx
    .select({ id: users.id, name: users.name, role: users.role, status: users.status })
    .from(users)
    .where(inArray(users.id, [managerId, staffId]))
    .orderBy(users.id)
    .for("update");
  const assignments = await tx
    .select()
    .from(facilityAssignments)
    .where(
      and(
        eq(facilityAssignments.facilityId, facilityId),
        inArray(facilityAssignments.userId, [managerId, staffId]),
        eq(facilityAssignments.isActive, true),
        or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
      ),
    )
    .orderBy(facilityAssignments.userId)
    .for("update");
  const manager = people.find(
    (p) => p.id === managerId && p.role === "FACILITY_MANAGER" && p.status === "ACTIVE",
  );
  if (!manager || !assignments.some((a) => a.userId === managerId && a.role === "FACILITY_MANAGER"))
    return { error: "MANAGER_ACCESS_DENIED" };
  const staff = people.find(
    (p) => p.id === staffId && p.role === "FACILITY_STAFF" && p.status === "ACTIVE",
  );
  if (!staff || !assignments.some((a) => a.userId === staffId && a.role === "FACILITY_STAFF"))
    return { error: "STAFF_UNAVAILABLE" };
  return { manager, staff };
}

async function lockManagerAssignment(
  tx: TaskTransaction,
  facilityId: string,
  managerId: string,
): Promise<boolean> {
  const [manager] = await tx
    .select({ id: users.id, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, managerId))
    .for("update");
  if (manager?.role !== "FACILITY_MANAGER" || manager.status !== "ACTIVE") return false;
  const [assignment] = await tx
    .select({ userId: facilityAssignments.userId })
    .from(facilityAssignments)
    .where(
      and(
        eq(facilityAssignments.userId, managerId),
        eq(facilityAssignments.facilityId, facilityId),
        eq(facilityAssignments.role, "FACILITY_MANAGER"),
        eq(facilityAssignments.isActive, true),
        or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
      ),
    )
    .for("update");
  return Boolean(assignment);
}

async function loadTaskRecord(tx: TaskTransaction, id: string) {
  const [task] = await tx
    .select(columns)
    .from(facilityTasks)
    .innerJoin(assignee, eq(assignee.id, facilityTasks.assignedStaffId))
    .innerJoin(assigner, eq(assigner.id, facilityTasks.assignedBy))
    .where(eq(facilityTasks.id, id));
  return task;
}
