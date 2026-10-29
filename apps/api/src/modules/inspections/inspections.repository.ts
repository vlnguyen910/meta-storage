import type { InspectionListQuery } from "@metastorage/contracts";
import { FacilityTaskReferenceType } from "@metastorage/contracts";
import {
  and,
  count,
  type Database,
  desc,
  eq,
  facilityTasks,
  type Inspection as InspectionRecord,
  type InspectionStatus,
  type InspectionType,
  inArray,
  inspections,
  storageUnits,
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

  async listForAppointment(appointmentId: string) {
    return this.db
      .select({ id: inspections.id })
      .from(inspections)
      .innerJoin(facilityTasks, eq(facilityTasks.id, inspections.taskId))
      .where(
        and(
          eq(facilityTasks.referenceId, appointmentId),
          eq(facilityTasks.referenceType, FacilityTaskReferenceType.APPOINTMENT),
        ),
      )
      .orderBy(desc(inspections.inspectedAt), desc(inspections.id));
  }

  async findTaskContext(taskId: string) {
    const [task] = await this.db.select().from(facilityTasks).where(eq(facilityTasks.id, taskId));
    return task;
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

  findInspectionTask(tx: TaskTransaction, taskId: string) {
    return tx.select().from(facilityTasks).where(eq(facilityTasks.id, taskId)).for("update");
  }

  findInspectionByTask(tx: TaskTransaction, taskId: string) {
    return tx.select().from(inspections).where(eq(inspections.taskId, taskId));
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
}
