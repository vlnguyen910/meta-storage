import type { InspectionListQuery } from "@metastorage/contracts";
import {
  FacilityTaskReferenceType,
  FacilityTaskStatus,
  FacilityTaskType,
} from "@metastorage/contracts/facility-tasks";
import {
  and,
  bookings,
  checkInVerifications,
  count,
  type Database,
  desc,
  eq,
  facilityTasks,
  type Inspection as InspectionRecord,
  type InspectionStatus,
  InspectionType,
  inArray,
  inspections,
  rentals,
  storageUnits,
  unitAssignments,
} from "@metastorage/database";
import type { TaskTransaction } from "../facility-tasks/facility-tasks.types";

export type InspectionRow = InspectionRecord & {
  facilityId: string;
  unitCode: string;
  assignedStaffId: string;
};

export class InspectionsRepository {
  constructor(private readonly db: Database) {}

  transaction<T>(callback: (tx: TaskTransaction) => Promise<T>) {
    return this.db.transaction(callback);
  }

  async find(id: string): Promise<InspectionRow | undefined> {
    const [row] = await this.db
      .select({
        inspection: inspections,
        facilityId: facilityTasks.facilityId,
        unitCode: storageUnits.code,
        assignedStaffId: facilityTasks.assignedStaffId,
      })
      .from(inspections)
      .innerJoin(facilityTasks, eq(facilityTasks.id, inspections.taskId))
      .innerJoin(storageUnits, eq(storageUnits.id, inspections.storageUnitId))
      .where(eq(inspections.id, id));
    return row
      ? {
          ...row.inspection,
          facilityId: row.facilityId,
          unitCode: row.unitCode,
          assignedStaffId: row.assignedStaffId,
        }
      : undefined;
  }

  async findAssignedBooking(bookingId: string) {
    const [booking] = await this.db
      .select({ assignedStaffId: bookings.assignedStaffId, facilityId: bookings.facilityId })
      .from(bookings)
      .where(eq(bookings.id, bookingId));
    return booking;
  }

  async listForBooking(bookingId: string, staffId: string) {
    const rows = await this.db
      .select({
        inspection: inspections,
        facilityId: facilityTasks.facilityId,
        unitCode: storageUnits.code,
        assignedStaffId: facilityTasks.assignedStaffId,
      })
      .from(inspections)
      .innerJoin(facilityTasks, eq(facilityTasks.id, inspections.taskId))
      .innerJoin(storageUnits, eq(storageUnits.id, inspections.storageUnitId))
      .where(
        and(
          eq(inspections.bookingId, bookingId),
          eq(inspections.inspectionType, InspectionType.CHECK_IN),
          eq(facilityTasks.assignedStaffId, staffId),
        ),
      )
      .orderBy(desc(facilityTasks.assignedAt), desc(inspections.inspectDoneAt));
    return rows.map((row) => ({
      ...row.inspection,
      facilityId: row.facilityId,
      unitCode: row.unitCode,
      assignedStaffId: row.assignedStaffId,
    }));
  }

  async startCheckIn(bookingId: string, staffId: string) {
    return this.db.transaction(async (tx) => {
      const [booking] = await tx
        .select({
          id: bookings.id,
          assignedStaffId: bookings.assignedStaffId,
          facilityId: bookings.facilityId,
          status: bookings.status,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .for("update");
      if (!booking) return { error: "BOOKING_NOT_FOUND" as const };
      if (booking.assignedStaffId !== staffId) return { error: "NOT_ASSIGNED" as const };
      if (booking.status !== "CONFIRMED") return { error: "BOOKING_NOT_READY" as const };

      const [assignment] = await tx
        .select({ id: unitAssignments.id, physicalUnitId: unitAssignments.physicalUnitId })
        .from(unitAssignments)
        .where(and(eq(unitAssignments.bookingId, bookingId), eq(unitAssignments.status, "ACTIVE")))
        .for("update");
      if (!assignment) return { error: "UNIT_NOT_ASSIGNED" as const };

      const [verification] = await tx
        .select({ id: checkInVerifications.id })
        .from(checkInVerifications)
        .where(
          and(
            eq(checkInVerifications.bookingId, bookingId),
            eq(checkInVerifications.facilityId, booking.facilityId),
            eq(checkInVerifications.staffId, staffId),
            eq(checkInVerifications.unitAssignmentId, assignment.id),
            eq(checkInVerifications.status, "VERIFIED"),
          ),
        )
        .for("update");
      if (!verification) return { error: "CHECK_IN_NOT_VERIFIED" as const };

      const [task] = await tx
        .select()
        .from(facilityTasks)
        .where(
          and(
            eq(facilityTasks.type, FacilityTaskType.CHECK_IN_HANDOVER),
            eq(facilityTasks.referenceType, FacilityTaskReferenceType.BOOKING),
            eq(facilityTasks.referenceId, bookingId),
            eq(facilityTasks.facilityId, booking.facilityId),
            eq(facilityTasks.assignedStaffId, staffId),
            inArray(facilityTasks.status, [
              FacilityTaskStatus.ASSIGNED,
              FacilityTaskStatus.IN_PROGRESS,
            ]),
          ),
        )
        .for("update");
      if (!task) return { error: "TASK_NOT_AVAILABLE" as const };

      const [existing] = await tx.select().from(inspections).where(eq(inspections.taskId, task.id));
      if (existing) return { inspection: existing };

      const [inspection] = await tx
        .insert(inspections)
        .values({
          storageUnitId: assignment.physicalUnitId,
          bookingId,
          inspectedBy: staffId,
          taskId: task.id,
          inspectionType: InspectionType.CHECK_IN,
        })
        .returning();
      if (!inspection) throw new Error("Check-in inspection insert returned no row");

      if (task.status === FacilityTaskStatus.ASSIGNED) {
        await tx
          .update(facilityTasks)
          .set({ status: FacilityTaskStatus.IN_PROGRESS, startedAt: new Date() })
          .where(eq(facilityTasks.id, task.id));
      }
      return { inspection };
    });
  }

  list(
    query: InspectionListQuery,
    scope: { staffId: string; facilityIds: string[] } | { facilityId: string },
  ) {
    const filters =
      "staffId" in scope
        ? [
            eq(facilityTasks.assignedStaffId, scope.staffId),
            inArray(facilityTasks.facilityId, scope.facilityIds),
          ]
        : [eq(facilityTasks.facilityId, scope.facilityId)];
    return this.listByFilters(filters, query);
  }

  private async listByFilters(scopeFilters: ReturnType<typeof eq>[], query: InspectionListQuery) {
    const filters = [...scopeFilters];
    if (query.status) filters.push(eq(inspections.status, query.status as InspectionStatus));
    if (query.inspectionType)
      filters.push(eq(inspections.inspectionType, query.inspectionType as InspectionType));
    if (query.storageUnitId) filters.push(eq(inspections.storageUnitId, query.storageUnitId));
    const where = and(...filters);
    const [total] = await this.db
      .select({ total: count() })
      .from(inspections)
      .innerJoin(facilityTasks, eq(facilityTasks.id, inspections.taskId))
      .where(where);
    const rows = await this.db
      .select({
        inspection: inspections,
        facilityId: facilityTasks.facilityId,
        unitCode: storageUnits.code,
        assignedStaffId: facilityTasks.assignedStaffId,
      })
      .from(inspections)
      .innerJoin(facilityTasks, eq(facilityTasks.id, inspections.taskId))
      .innerJoin(storageUnits, eq(storageUnits.id, inspections.storageUnitId))
      .where(where)
      .orderBy(desc(facilityTasks.assignedAt), desc(inspections.inspectDoneAt))
      .limit(query.limit)
      .offset(query.offset);
    return {
      items: rows.map((row) => ({
        ...row.inspection,
        facilityId: row.facilityId,
        unitCode: row.unitCode,
        assignedStaffId: row.assignedStaffId,
      })),
      total: total?.total ?? 0,
    };
  }

  findForUpdate(tx: TaskTransaction, id: string) {
    return tx.select().from(inspections).where(eq(inspections.id, id)).for("update");
  }

  findByTask(tx: TaskTransaction, taskId: string) {
    return tx.select().from(inspections).where(eq(inspections.taskId, taskId));
  }

  create(tx: TaskTransaction, input: typeof inspections.$inferInsert) {
    return tx.insert(inspections).values(input).returning();
  }

  update(
    tx: TaskTransaction,
    id: string,
    input: Partial<
      Pick<
        InspectionRecord,
        "status" | "condition" | "checklist" | "notes" | "inspectedAt" | "inspectDoneAt"
      >
    >,
  ) {
    return tx.update(inspections).set(input).where(eq(inspections.id, id)).returning();
  }

  handover(id: string, staffId: string) {
    return this.db.transaction(async (tx) => {
      const [reference] = await tx
        .select({ bookingId: inspections.bookingId })
        .from(inspections)
        .where(eq(inspections.id, id));
      if (!reference?.bookingId) return { error: "NOT_FOUND" as const };

      const [booking] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, reference.bookingId))
        .for("update");
      if (!booking) return { error: "NOT_FOUND" as const };
      if (booking.assignedStaffId !== staffId) return { error: "NOT_ASSIGNED" as const };

      const [inspection] = await tx
        .select()
        .from(inspections)
        .where(eq(inspections.id, id))
        .for("update");
      if (
        !inspection ||
        inspection.bookingId !== booking.id ||
        inspection.inspectionType !== InspectionType.CHECK_IN ||
        inspection.status !== "PASSED"
      )
        return { error: "NOT_READY" as const };

      if (booking.status === "CHECKED_IN") {
        const [rental] = await tx.select().from(rentals).where(eq(rentals.bookingId, booking.id));
        return rental ? { inspection } : { error: "NOT_READY" as const };
      }
      if (booking.status !== "CONFIRMED") return { error: "NOT_READY" as const };

      const [assignment] = await tx
        .select()
        .from(unitAssignments)
        .where(and(eq(unitAssignments.bookingId, booking.id), eq(unitAssignments.status, "ACTIVE")))
        .for("update");
      if (!assignment || assignment.physicalUnitId !== inspection.storageUnitId)
        return { error: "NOT_READY" as const };

      const [verification] = await tx
        .select()
        .from(checkInVerifications)
        .where(
          and(
            eq(checkInVerifications.bookingId, booking.id),
            eq(checkInVerifications.facilityId, booking.facilityId),
            eq(checkInVerifications.staffId, staffId),
            eq(checkInVerifications.unitAssignmentId, assignment.id),
            eq(checkInVerifications.status, "VERIFIED"),
          ),
        )
        .for("update");
      const [task] = await tx
        .select()
        .from(facilityTasks)
        .where(
          and(
            eq(facilityTasks.id, inspection.taskId),
            eq(facilityTasks.type, FacilityTaskType.CHECK_IN_HANDOVER),
            eq(facilityTasks.referenceType, FacilityTaskReferenceType.BOOKING),
            eq(facilityTasks.referenceId, booking.id),
            eq(facilityTasks.facilityId, booking.facilityId),
            eq(facilityTasks.assignedStaffId, staffId),
            eq(facilityTasks.status, FacilityTaskStatus.IN_PROGRESS),
          ),
        )
        .for("update");
      if (!verification || !task) return { error: "NOT_READY" as const };

      const now = new Date();
      await tx.insert(rentals).values({
        bookingId: booking.id,
        facilityId: booking.facilityId,
        physicalUnitId: assignment.physicalUnitId,
        startAt: now,
        expectedEndAt: booking.rentalEndAt,
        depositAmount: booking.depositAmount,
      });
      await tx
        .update(storageUnits)
        .set({ status: "OCCUPIED", updatedAt: now })
        .where(eq(storageUnits.id, assignment.physicalUnitId));
      await tx
        .update(bookings)
        .set({ status: "CHECKED_IN", updatedAt: now })
        .where(eq(bookings.id, booking.id));
      await tx
        .update(checkInVerifications)
        .set({ status: "CONSUMED", consumedAt: now, updatedAt: now })
        .where(eq(checkInVerifications.id, verification.id));
      await tx
        .update(facilityTasks)
        .set({ status: FacilityTaskStatus.COMPLETED, completedAt: now, updatedAt: now })
        .where(eq(facilityTasks.id, task.id));
      return { inspection };
    });
  }
}
