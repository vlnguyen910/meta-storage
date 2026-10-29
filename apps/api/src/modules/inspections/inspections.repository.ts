import type { InspectionListQuery, UpdatePolicyViolationFeeCatalog } from "@metastorage/contracts";
import { FacilityTaskReferenceType } from "@metastorage/contracts";
import {
  alias,
  and,
  bookings,
  count,
  type Database,
  desc,
  eq,
  facilityTasks,
  type Inspection as InspectionRecord,
  InspectionStatus,
  InspectionType,
  inArray,
  inspections,
  isNull,
  or,
  PaymentType,
  payments,
  policyViolationFees,
  RentalStatus,
  rentals,
  reservations,
  sql,
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

  async findTaskContext(taskId: string, executor: Database | TaskTransaction = this.db) {
    const [task] = await executor.select().from(facilityTasks).where(eq(facilityTasks.id, taskId));
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

  private policyRows(executor: Database | TaskTransaction, lock = false) {
    const query = executor
      .select()
      .from(policyViolationFees)
      .where(isNull(policyViolationFees.referenceId))
      .orderBy(policyViolationFees.violationCode);
    return lock ? query.for("share") : query;
  }

  async policyCatalog(executor: Database | TaskTransaction = this.db) {
    const items = await this.policyRows(executor);
    return {
      version: items.reduce((version, item) => Math.max(version, item.policyVersion), 0),
      items: items.map(({ violationCode: code, violationName: name, amount, isActive }) => ({
        code,
        name,
        amount,
        isActive,
      })),
    };
  }

  async updatePolicyCatalog(input: UpdatePolicyViolationFeeCatalog) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('policy_violation_fee_catalog'))`);
      const existing = await tx
        .select()
        .from(policyViolationFees)
        .where(isNull(policyViolationFees.referenceId))
        .for("update");
      const version = existing.reduce((current, item) => Math.max(current, item.policyVersion), 0);
      if (version !== input.expectedVersion) return undefined;
      if (existing.length === 0 && input.items.length === 0) return { version, items: [] };
      const nextVersion = version + 1;
      const byCode = new Map(existing.map((row) => [row.violationCode, row]));
      for (const row of existing) {
        const item = input.items.find((candidate) => candidate.code === row.violationCode);
        await tx
          .update(policyViolationFees)
          .set({
            isActive: item?.isActive ?? false,
            ...(item ? { violationName: item.name, amount: item.amount } : {}),
            policyVersion: nextVersion,
          })
          .where(eq(policyViolationFees.id, row.id));
      }
      const added = input.items.filter((item) => !byCode.has(item.code));
      if (added.length)
        await tx.insert(policyViolationFees).values(
          added.map((item) => ({
            violationCode: item.code,
            violationName: item.name,
            amount: item.amount,
            isActive: item.isActive,
            policyVersion: nextVersion,
          })),
        );
      return { version: nextVersion, items: input.items };
    });
  }

  async activePolicyFees(tx: TaskTransaction) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('policy_violation_fee_catalog'))`);
    const rows = await this.policyRows(tx, true);
    return {
      version: rows.reduce((version, row) => Math.max(version, row.policyVersion), 0),
      rows: rows.filter((row) => row.isActive),
    };
  }

  listInspectionFees(inspectionId: string, executor: Database | TaskTransaction = this.db) {
    return executor
      .select()
      .from(policyViolationFees)
      .where(
        and(
          eq(policyViolationFees.referenceType, "INSPECTION"),
          eq(policyViolationFees.referenceId, inspectionId),
        ),
      )
      .orderBy(policyViolationFees.violationCode);
  }

  async replaceInspectionFees(
    tx: TaskTransaction,
    inspectionId: string,
    policyVersion: number,
    violations: { code: string; note?: string }[],
  ) {
    const catalog = await this.activePolicyFees(tx);
    if (catalog.version !== policyVersion) return undefined;
    const byCode = new Map(catalog.rows.map((row) => [row.violationCode, row]));
    const selected = violations.map(({ code, note }) => {
      const item = byCode.get(code);
      return (
        item && {
          referenceType: "INSPECTION",
          referenceId: inspectionId,
          violationCode: item.violationCode,
          violationName: item.violationName,
          amount: item.amount,
          policyVersion,
          note: note?.trim() || null,
          isActive: false,
        }
      );
    });
    if (selected.some((item) => !item)) return undefined;
    await tx
      .delete(policyViolationFees)
      .where(
        and(
          eq(policyViolationFees.referenceType, "INSPECTION"),
          eq(policyViolationFees.referenceId, inspectionId),
        ),
      );
    if (selected.length)
      await tx
        .insert(policyViolationFees)
        .values(selected as NonNullable<(typeof selected)[number]>[]);
    return selected;
  }

  async findReturnContext(inspectionId: string) {
    const checkIn = alias(inspections, "return_check_in_inspection");
    const [row] = await this.db
      .select({
        rental: rentals,
        depositAmount: sql<number>`coalesce(${reservations.depositAmount}, ${bookings.depositAmount})::int`,
        checkIn: checkIn,
      })
      .from(inspections)
      .innerJoin(rentals, eq(rentals.id, inspections.rentalId))
      .leftJoin(reservations, eq(reservations.id, rentals.reservationId))
      .leftJoin(bookings, eq(bookings.id, rentals.bookingId))
      .leftJoin(
        checkIn,
        and(
          eq(checkIn.inspectionType, InspectionType.CHECK_IN),
          eq(checkIn.status, InspectionStatus.PASSED),
          or(
            and(
              eq(checkIn.reservationId, rentals.reservationId),
              eq(checkIn.storageUnitId, rentals.storageUnitId),
            ),
            and(
              eq(checkIn.bookingId, rentals.bookingId),
              eq(checkIn.storageUnitId, rentals.storageUnitId),
            ),
          ),
        ),
      )
      .where(
        and(
          eq(inspections.id, inspectionId),
          eq(inspections.inspectionType, InspectionType.CHECK_OUT),
        ),
      );
    return row;
  }

  async lockSourcePayment(tx: TaskTransaction, rentalId: string) {
    const [row] = await tx
      .select({
        payment: payments,
        depositAmount: sql<number>`coalesce(${reservations.depositAmount}, ${bookings.depositAmount})::int`,
        quoteTotal: sql<number>`coalesce(${reservations.totalAmount}, ${bookings.totalAmount})::int`,
        bookingId: rentals.bookingId,
        reservationId: rentals.reservationId,
      })
      .from(rentals)
      .leftJoin(reservations, eq(reservations.id, rentals.reservationId))
      .leftJoin(bookings, eq(bookings.id, rentals.bookingId))
      .innerJoin(
        payments,
        or(
          eq(payments.reservationId, rentals.reservationId),
          eq(payments.bookingId, rentals.bookingId),
        ),
      )
      .where(
        and(
          eq(rentals.id, rentalId),
          eq(payments.type, PaymentType.CHARGE),
          eq(payments.status, "SUCCEEDED"),
        ),
      )
      .orderBy(desc(payments.paidAt), desc(payments.id))
      .limit(1)
      .for("update", { of: payments });
    return row;
  }

  closeRental(tx: TaskTransaction, rentalId: string, now: Date) {
    return tx
      .update(rentals)
      .set({ status: RentalStatus.CLOSED, closedAt: now, updatedAt: now })
      .where(and(eq(rentals.id, rentalId), eq(rentals.status, RentalStatus.ACTIVE)))
      .returning();
  }

  createDepositRefund(
    tx: TaskTransaction,
    input: {
      rentalId: string;
      sourcePaymentId: string;
      bookingId: string | null;
      reservationId: string | null;
      amount: number;
      currency: string;
    },
  ) {
    return tx
      .insert(payments)
      .values({
        type: PaymentType.DEPOSIT_REFUND,
        bookingId: input.bookingId,
        reservationId: input.reservationId,
        rentalId: input.rentalId,
        sourcePaymentId: input.sourcePaymentId,
        idempotencyKey: `return-deposit:${input.rentalId}`,
        totalAmount: String(input.amount),
        currency: input.currency,
        status: "REFUND_PENDING",
      })
      .returning();
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

  findByTask(taskId: string, executor: Database | TaskTransaction = this.db) {
    return executor.select().from(inspections).where(eq(inspections.taskId, taskId));
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
