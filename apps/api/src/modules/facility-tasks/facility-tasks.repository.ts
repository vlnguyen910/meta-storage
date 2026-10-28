import {
  type CreateFacilityTaskInput,
  type FacilityTaskDashboardSummary,
  type FacilityTaskListQuery,
  FacilityTaskReferenceType,
  FacilityTaskStatus,
  FacilityTaskType,
  FacilityTaskTypeReferenceSchema,
  type StaffFacilityTaskListQuery,
  type UpdateFacilityTaskInput,
  UserRole,
} from "@metastorage/contracts";
import {
  aliasedTable,
  and,
  BookingStatus,
  bookings,
  count,
  type Database,
  desc,
  eq,
  facilityTasks,
  getTableColumns,
  inArray,
  sql,
  storageUnits,
  supportTickets,
  users,
} from "@metastorage/database";
import type { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import type {
  FacilityTaskActor,
  FacilityTaskRecord,
  TaskTransaction,
  TaskWriteResult,
} from "./facility-tasks.types";

const assignee = aliasedTable(users, "task_assignee");
const assigner = aliasedTable(users, "task_assigner");
const taskColumns = {
  ...getTableColumns(facilityTasks),
  assignedStaffName: assignee.name,
  assignerName: assigner.name,
};

export class FacilityTasksRepository {
  constructor(
    private readonly db: Database,
    private readonly assignments: FacilityAssignmentsRepository,
  ) {}

  find(tx: TaskTransaction, id: string) {
    return tx.select().from(facilityTasks).where(eq(facilityTasks.id, id));
  }

  findForUpdate(tx: TaskTransaction, id: string) {
    return tx.select().from(facilityTasks).where(eq(facilityTasks.id, id)).for("update");
  }

  async create(input: CreateFacilityTaskInput, actor: FacilityTaskActor): Promise<TaskWriteResult> {
    return this.db.transaction(async (tx) => {
      const activeAssignments = await this.assignments.lockActiveAssignments(tx, input.facilityId, [
        { userId: actor.id, role: UserRole.FACILITY_MANAGER },
        { userId: input.assignedStaffId, role: UserRole.FACILITY_STAFF },
      ]);
      if (!activeAssignments.has(actor.id)) return { error: "MANAGER_ACCESS_DENIED" };
      if (!activeAssignments.has(input.assignedStaffId)) return { error: "STAFF_UNAVAILABLE" };
      if (!FacilityTaskTypeReferenceSchema.safeParse(input).success)
        return { error: "CONTEXT_MISMATCH" };
      if (
        !(await referenceExistsAtFacility(
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
          description: input.description?.trim() || null,
          assignedStaffId: input.assignedStaffId,
          assignedBy: actor.id,
        })
        .returning();
      if (!task) throw new Error("Facility task insert returned no row");
      return { task: await loadTask(tx, task.id) };
    });
  }

  async assignBookingHandover(
    tx: TaskTransaction,
    facilityId: string,
    bookingId: string,
    staffId: string,
    managerId: string,
  ): Promise<void> {
    const [activeTask] = await tx
      .select()
      .from(facilityTasks)
      .where(
        and(
          eq(facilityTasks.type, FacilityTaskType.CHECK_IN_HANDOVER),
          eq(facilityTasks.referenceType, FacilityTaskReferenceType.BOOKING),
          eq(facilityTasks.referenceId, bookingId),
          inArray(facilityTasks.status, [
            FacilityTaskStatus.ASSIGNED,
            FacilityTaskStatus.IN_PROGRESS,
          ]),
        ),
      )
      .for("update");
    const now = new Date();
    if (activeTask) {
      if (activeTask.assignedStaffId !== staffId)
        await tx
          .update(facilityTasks)
          .set({
            assignedStaffId: staffId,
            assignedBy: managerId,
            assignedAt: now,
            status: FacilityTaskStatus.ASSIGNED,
            startedAt: null,
            updatedAt: now,
          })
          .where(eq(facilityTasks.id, activeTask.id));
      return;
    }

    await tx.insert(facilityTasks).values({
      facilityId,
      type: FacilityTaskType.CHECK_IN_HANDOVER,
      status: FacilityTaskStatus.ASSIGNED,
      referenceType: FacilityTaskReferenceType.BOOKING,
      referenceId: bookingId,
      assignedStaffId: staffId,
      assignedBy: managerId,
      assignedAt: now,
    });
  }

  async listForStaff(staffId: string, facilityIds: string[], query: StaffFacilityTaskListQuery) {
    return this.list(
      and(
        eq(facilityTasks.assignedStaffId, staffId),
        inArray(facilityTasks.facilityId, facilityIds),
        query.type ? eq(facilityTasks.type, query.type) : undefined,
      ),
      query,
    );
  }

  async listForFacility(facilityId: string, query: FacilityTaskListQuery) {
    return this.list(
      and(
        eq(facilityTasks.facilityId, facilityId),
        query.assignedStaffId
          ? eq(facilityTasks.assignedStaffId, query.assignedStaffId)
          : undefined,
        query.type ? eq(facilityTasks.type, query.type) : undefined,
      ),
      query,
    );
  }

  async dashboardForStaff(
    staffId: string,
    facilityIds: string[],
  ): Promise<FacilityTaskDashboardSummary> {
    const [summary] = await this.db
      .select({
        date: sql<string>`(current_timestamp at time zone 'Asia/Ho_Chi_Minh')::date::text`,
        pendingCount: count().mapWith(Number),
        byType: {
          CHECK_IN_HANDOVER:
            sql<number>`count(*) filter (where ${facilityTasks.type} = ${FacilityTaskType.CHECK_IN_HANDOVER})::int`.mapWith(
              Number,
            ),
          UNIT_INSPECTION:
            sql<number>`count(*) filter (where ${facilityTasks.type} = ${FacilityTaskType.UNIT_INSPECTION})::int`.mapWith(
              Number,
            ),
          HANDLE_SUPPORT:
            sql<number>`count(*) filter (where ${facilityTasks.type} = ${FacilityTaskType.HANDLE_SUPPORT})::int`.mapWith(
              Number,
            ),
        },
      })
      .from(facilityTasks)
      .where(
        and(
          eq(facilityTasks.assignedStaffId, staffId),
          inArray(facilityTasks.facilityId, facilityIds),
          inArray(facilityTasks.status, [
            FacilityTaskStatus.ASSIGNED,
            FacilityTaskStatus.IN_PROGRESS,
          ]),
          sql`(${facilityTasks.assignedAt} at time zone 'Asia/Ho_Chi_Minh')::date = (current_timestamp at time zone 'Asia/Ho_Chi_Minh')::date`,
        ),
      );
    if (!summary) throw new Error("Facility task dashboard query returned no row");
    return summary;
  }

  private async list(filter: ReturnType<typeof and>, query: { limit: number; offset: number }) {
    return this.db.transaction(
      async (tx) => {
        const [total] = await tx.select({ value: count() }).from(facilityTasks).where(filter);
        const items = await tx
          .select(taskColumns)
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

  async update(
    id: string,
    input: UpdateFacilityTaskInput,
    actor: FacilityTaskActor,
  ): Promise<TaskWriteResult> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(facilityTasks)
        .where(eq(facilityTasks.id, id))
        .for("update");
      if (!current) return { error: "TASK_NOT_FOUND" };
      if ("status" in input) return this.updateStatus(tx, current, input.status, actor);
      return this.updateDetails(tx, current, input, actor);
    });
  }

  private async updateStatus(
    tx: TaskTransaction,
    current: typeof facilityTasks.$inferSelect,
    status:
      | FacilityTaskStatus.IN_PROGRESS
      | FacilityTaskStatus.COMPLETED
      | FacilityTaskStatus.CANCELLED,
    actor: FacilityTaskActor,
  ): Promise<TaskWriteResult> {
    if (status === FacilityTaskStatus.CANCELLED) {
      if (
        current.status === FacilityTaskStatus.COMPLETED ||
        current.status === FacilityTaskStatus.CANCELLED
      )
        return { error: "INVALID_TASK_STATE" };
      const managers = await this.assignments.lockActiveAssignments(tx, current.facilityId, [
        { userId: actor.id, role: UserRole.FACILITY_MANAGER },
      ]);
      if (!managers.has(actor.id)) return { error: "MANAGER_ACCESS_DENIED" };
    } else {
      if (actor.role !== UserRole.FACILITY_STAFF || current.assignedStaffId !== actor.id)
        return { error: "TASK_ACCESS_DENIED" };
      const staff = await this.assignments.lockActiveAssignments(tx, current.facilityId, [
        { userId: actor.id, role: UserRole.FACILITY_STAFF },
      ]);
      if (!staff.has(actor.id)) return { error: "TASK_ACCESS_DENIED" };
      if (
        (status === FacilityTaskStatus.IN_PROGRESS &&
          current.status !== FacilityTaskStatus.ASSIGNED) ||
        (status === FacilityTaskStatus.COMPLETED &&
          current.status !== FacilityTaskStatus.IN_PROGRESS)
      )
        return { error: "INVALID_TASK_STATE" };
      if (
        status === FacilityTaskStatus.COMPLETED &&
        current.type === FacilityTaskType.CHECK_IN_HANDOVER
      ) {
        const [booking] = await tx
          .select({ status: bookings.status })
          .from(bookings)
          .where(eq(bookings.id, current.referenceId));
        if (booking?.status !== BookingStatus.CHECKED_IN) return { error: "INVALID_TASK_STATE" };
      }
    }

    const now = new Date();
    const [updated] = await tx
      .update(facilityTasks)
      .set({
        status,
        ...(status === FacilityTaskStatus.IN_PROGRESS ? { startedAt: now } : {}),
        ...(status === FacilityTaskStatus.COMPLETED ? { completedAt: now } : {}),
        updatedAt: now,
      })
      .where(eq(facilityTasks.id, current.id))
      .returning();
    if (!updated) return { error: "TASK_NOT_FOUND" };
    return { task: await loadTask(tx, updated.id) };
  }

  private async updateDetails(
    tx: TaskTransaction,
    current: typeof facilityTasks.$inferSelect,
    input: Exclude<UpdateFacilityTaskInput, { status: FacilityTaskStatus }>,
    actor: FacilityTaskActor,
  ): Promise<TaskWriteResult> {
    if (actor.role !== UserRole.FACILITY_MANAGER) return { error: "MANAGER_ACCESS_DENIED" };
    if (
      current.status === FacilityTaskStatus.COMPLETED ||
      current.status === FacilityTaskStatus.CANCELLED
    )
      return { error: "INVALID_TASK_STATE" };
    const managers = await this.assignments.lockActiveAssignments(tx, current.facilityId, [
      { userId: actor.id, role: UserRole.FACILITY_MANAGER },
    ]);
    if (!managers.has(actor.id)) return { error: "MANAGER_ACCESS_DENIED" };
    if (
      input.type &&
      (current.type === FacilityTaskType.CHECK_IN_HANDOVER ||
        input.type === FacilityTaskType.CHECK_IN_HANDOVER)
    )
      return { error: "TASK_TYPE_LOCKED" };
    if (
      input.type &&
      !FacilityTaskTypeReferenceSchema.safeParse({
        type: input.type,
        referenceType: current.referenceType,
      }).success
    )
      return { error: "CONTEXT_MISMATCH" };

    const staffId = input.assignedStaffId ?? current.assignedStaffId;
    if (input.assignedStaffId && input.assignedStaffId !== current.assignedStaffId) {
      const staff = await this.assignments.lockActiveAssignments(tx, current.facilityId, [
        { userId: staffId, role: UserRole.FACILITY_STAFF },
      ]);
      if (!staff.has(staffId)) return { error: "STAFF_UNAVAILABLE" };
    }

    const staffChanged = staffId !== current.assignedStaffId;
    const typeChanged = input.type !== undefined && input.type !== current.type;
    const description = input.description?.trim() || null;
    const descriptionChanged =
      input.description !== undefined && description !== current.description;
    if (!staffChanged && !typeChanged && !descriptionChanged)
      return { task: await loadTask(tx, current.id) };

    const now = new Date();
    const [updated] = await tx
      .update(facilityTasks)
      .set({
        ...(typeChanged ? { type: input.type } : {}),
        ...(descriptionChanged ? { description } : {}),
        ...(staffChanged
          ? {
              assignedStaffId: staffId,
              assignedBy: actor.id,
              assignedAt: now,
              status: FacilityTaskStatus.ASSIGNED,
              startedAt: null,
              completedAt: null,
            }
          : {}),
        updatedAt: now,
      })
      .where(eq(facilityTasks.id, current.id))
      .returning();
    if (!updated) return { error: "TASK_NOT_FOUND" };
    return { task: await loadTask(tx, updated.id) };
  }
}

async function referenceExistsAtFacility(
  tx: TaskTransaction,
  referenceType: FacilityTaskReferenceType,
  referenceId: string,
  facilityId: string,
) {
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

async function loadTask(tx: TaskTransaction, id: string): Promise<FacilityTaskRecord> {
  const [task] = await tx
    .select(taskColumns)
    .from(facilityTasks)
    .innerJoin(assignee, eq(assignee.id, facilityTasks.assignedStaffId))
    .innerJoin(assigner, eq(assigner.id, facilityTasks.assignedBy))
    .where(eq(facilityTasks.id, id));
  if (!task) throw new Error("Facility task was not found after update");
  return task;
}
