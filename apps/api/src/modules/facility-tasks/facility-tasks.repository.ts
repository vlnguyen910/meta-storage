import {
  type AssignFacilityTaskInput,
  type CreateFacilityTaskInput,
  type FacilityTaskListQuery,
  FacilityTaskReferenceType,
  FacilityTaskType,
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
  supportTickets,
  users,
} from "@metastorage/database";
import type {
  FacilityTaskRecord,
  LockedTaskActors,
  TaskTransaction,
  TaskWriteResult,
} from "./facility-tasks.types";

const assignee = aliasedTable(users, "task_assignee");
const assigner = aliasedTable(users, "task_assigner");
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

  async create(input: CreateFacilityTaskInput, managerId: string): Promise<TaskWriteResult> {
    return this.db.transaction(async (tx) => {
      const actors = await lockTaskActors(tx, input.facilityId, managerId, input.assignedStaffId);
      if ("error" in actors) return actors;
      if (
        !(await referenceMatchesFacility(
          tx,
          input.referenceType,
          input.referenceId,
          input.facilityId,
        ))
      )
        return { error: "CONTEXT_MISMATCH" };
      const [task] = await tx
        .insert(facilityTasks)
        .values({
          facilityId: input.facilityId,
          type: input.type,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          assignedStaffId: input.assignedStaffId,
          assignedBy: managerId,
        })
        .returning();
      if (!task) throw new Error("Facility task insert returned no row");
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
      if (current.status === "COMPLETED" || current.status === "CANCELLED")
        return { error: "INVALID_TASK_STATE" };
      const actors = await lockTaskActors(tx, current.facilityId, managerId, input.assignedStaffId);
      if ("error" in actors) return actors;
      if (current.version !== input.version) return { error: "VERSION_CONFLICT" };
      if (current.assignedStaffId === input.assignedStaffId) {
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
          status: "ASSIGNED",
          startedAt: null,
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

  async start(id: string, staffId: string): Promise<TaskWriteResult> {
    return this.changeLifecycle(id, staffId, false);
  }

  async complete(id: string, staffId: string): Promise<TaskWriteResult> {
    return this.changeLifecycle(id, staffId, true);
  }

  async cancel(id: string, managerId: string): Promise<TaskWriteResult> {
    return this.db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(facilityTasks)
        .where(eq(facilityTasks.id, id))
        .for("update");
      if (!task) return { error: "TASK_NOT_FOUND" };
      if (task.status === "COMPLETED" || task.status === "CANCELLED")
        return { error: "INVALID_TASK_STATE" };
      const manager = await lockManager(tx, task.facilityId, managerId);
      if (!manager) return { error: "MANAGER_ACCESS_DENIED" };
      const [updated] = await tx
        .update(facilityTasks)
        .set({ status: "CANCELLED", updatedAt: new Date(), version: task.version + 1 })
        .where(and(eq(facilityTasks.id, id), eq(facilityTasks.version, task.version)))
        .returning();
      if (!updated) return { error: "VERSION_CONFLICT" };
      return { task: await loadTaskRecord(tx, updated.id) };
    });
  }

  private async changeLifecycle(
    id: string,
    staffId: string,
    complete: boolean,
  ): Promise<TaskWriteResult> {
    return this.db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(facilityTasks)
        .where(eq(facilityTasks.id, id))
        .for("update");
      if (!task) return { error: "TASK_NOT_FOUND" };
      if (task.assignedStaffId !== staffId) return { error: "TASK_ACCESS_DENIED" };
      if (complete ? task.status !== "IN_PROGRESS" : task.status !== "ASSIGNED")
        return { error: "INVALID_TASK_STATE" };
      if (complete && task.type === FacilityTaskType.CHECK_IN_HANDOVER) {
        const [booking] = await tx
          .select({ status: bookings.status })
          .from(bookings)
          .where(eq(bookings.id, task.referenceId));
        if (booking?.status !== "CHECKED_IN") return { error: "INVALID_TASK_STATE" };
      }
      const [staff] = await tx
        .select({ id: users.id, name: users.name, role: users.role, status: users.status })
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
      const [updated] = await tx
        .update(facilityTasks)
        .set({
          status: complete ? "COMPLETED" : "IN_PROGRESS",
          startedAt: complete ? task.startedAt : now,
          completedAt: complete ? now : null,
          updatedAt: now,
          version: task.version + 1,
        })
        .where(and(eq(facilityTasks.id, id), eq(facilityTasks.version, task.version)))
        .returning();
      if (!updated) return { error: "VERSION_CONFLICT" };
      return {
        task: await loadTaskRecord(tx, updated.id),
      };
    });
  }
}

async function referenceMatchesFacility(
  tx: TaskTransaction,
  referenceType: CreateFacilityTaskInput["referenceType"],
  referenceId: string,
  facilityId: string,
): Promise<boolean> {
  if (referenceType === FacilityTaskReferenceType.BOOKING) {
    const [row] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.id, referenceId), eq(bookings.facilityId, facilityId)))
      .for("update");
    return Boolean(row);
  }
  if (referenceType === FacilityTaskReferenceType.STORAGE_UNIT) {
    const [row] = await tx
      .select({ id: storageUnits.id })
      .from(storageUnits)
      .where(and(eq(storageUnits.id, referenceId), eq(storageUnits.facilityId, facilityId)))
      .for("update");
    return Boolean(row);
  }
  const [row] = await tx
    .select({ id: supportTickets.id })
    .from(supportTickets)
    .where(and(eq(supportTickets.id, referenceId), eq(supportTickets.facilityId, facilityId)))
    .for("update");
  return Boolean(row);
}

async function lockTaskActors(
  tx: TaskTransaction,
  facilityId: string,
  managerId: string,
  staffId: string,
): Promise<LockedTaskActors> {
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
    (person) =>
      person.id === managerId && person.role === "FACILITY_MANAGER" && person.status === "ACTIVE",
  );
  if (!manager || !assignments.some((a) => a.userId === managerId && a.role === "FACILITY_MANAGER"))
    return { error: "MANAGER_ACCESS_DENIED" };
  const staff = people.find(
    (person) =>
      person.id === staffId && person.role === "FACILITY_STAFF" && person.status === "ACTIVE",
  );
  if (!staff || !assignments.some((a) => a.userId === staffId && a.role === "FACILITY_STAFF"))
    return { error: "STAFF_UNAVAILABLE" };
  return { manager, staff };
}

async function lockManager(
  tx: TaskTransaction,
  facilityId: string,
  managerId: string,
): Promise<{ id: string; name: string } | null> {
  const [manager] = await tx
    .select({ id: users.id, name: users.name, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, managerId))
    .for("update");
  if (manager?.role !== "FACILITY_MANAGER" || manager.status !== "ACTIVE") return null;
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
  return assignment ? { id: manager.id, name: manager.name } : null;
}

async function loadTaskRecord(tx: TaskTransaction, id: string): Promise<FacilityTaskRecord> {
  const [record] = await tx
    .select(columns)
    .from(facilityTasks)
    .innerJoin(assignee, eq(assignee.id, facilityTasks.assignedStaffId))
    .innerJoin(assigner, eq(assigner.id, facilityTasks.assignedBy))
    .where(eq(facilityTasks.id, id));
  if (!record) throw new Error("Facility task disappeared during lifecycle update");
  return record;
}
