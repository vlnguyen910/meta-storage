import {
  RETURN_MESSAGES as m,
  type ReturnQueueQuery,
  SystemSettingKey,
} from "@metastorage/contracts";
import {
  and,
  bookings,
  capacityAllocations,
  checkInSlots,
  type Database,
  desc,
  eq,
  facilities,
  facilityAssignments,
  gt,
  gte,
  inArray,
  isNull,
  lte,
  or,
  payments,
  rentalChargeAdjustments,
  rentalChargeEvents,
  rentalChargeRefunds,
  rentalCharges,
  rentals,
  returnAudit,
  returnChecklistVersions,
  returnEvidencePhotos,
  returnInspectionPhotos,
  returnInspections,
  returnRefunds,
  returnRequests,
  returnSettlements,
  returnTimeChanges,
  sql,
  storageUnits,
  systemSettingChanges,
  systemSettingInteger,
  systemSettings,
  unitAssignments,
  unitTypes,
  users,
} from "@metastorage/database";
import { NotFoundError } from "../../common/errors/app-error";
import { bookingCustomer } from "../bookings/bookings.projection";
import { lifecycleReturnDetail } from "../notifications/lifecycle-notifications.messages";
import { recordLifecycleEvent } from "../notifications/lifecycle-notifications.repository";
import type { ReturnContext, ReturnRequestRow, ReturnTransaction } from "./returns.types";

export class ReturnsRepository {
  constructor(readonly db: Database) {}

  async context(rentalId: string): Promise<ReturnContext> {
    const [row] = await this.db
      .select({ rental: rentals, booking: bookings })
      .from(rentals)
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .innerJoin(bookingCustomer, eq(bookingCustomer.id, bookings.userId))
      .where(eq(rentals.id, rentalId));
    if (!row) throw new NotFoundError(m.notFound);
    return row;
  }

  async request(id: string) {
    const [row] = await this.db.select().from(returnRequests).where(eq(returnRequests.id, id));
    if (!row) throw new NotFoundError(m.notFound);
    return row;
  }

  async locked<T>(
    rentalId: string,
    work: (tx: ReturnTransaction, context: ReturnContext) => Promise<T>,
  ): Promise<T> {
    const initial = await this.context(rentalId);
    return this.db.transaction(async (tx) => {
      // Schedule configuration also locks the facility before flagging appointments.
      // Keep this order to avoid confirmation/configuration deadlocks.
      await this.lockFacility(tx, initial.rental.facilityId);
      // Same booking-first lock order as handover/cancellation, before the rental.
      const [booking] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, initial.booking.id))
        .for("update");
      const [rental] = await tx
        .select()
        .from(rentals)
        .where(eq(rentals.id, rentalId))
        .for("update");
      if (!booking || !rental) throw new NotFoundError(m.notFound);
      return work(tx, { rental, booking });
    });
  }

  async lockedRequest<T>(
    id: string,
    work: (tx: ReturnTransaction, context: ReturnContext, request: ReturnRequestRow) => Promise<T>,
  ) {
    const initial = await this.request(id);
    return this.locked(initial.rentalId, async (tx, context) => {
      const [request] = await tx
        .select()
        .from(returnRequests)
        .where(eq(returnRequests.id, id))
        .for("update");
      if (!request) throw new NotFoundError(m.notFound);
      return work(tx, context, request);
    });
  }

  async member(
    tx: ReturnTransaction,
    facilityId: string,
    userId: string,
    role: "FACILITY_MANAGER" | "FACILITY_STAFF",
  ) {
    // Match account/membership changes: lock the user before its assignment.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("share");
    const [row] = await tx
      .select({ id: facilityAssignments.id })
      .from(facilityAssignments)
      .innerJoin(users, eq(users.id, facilityAssignments.userId))
      .where(
        and(
          eq(facilityAssignments.facilityId, facilityId),
          eq(facilityAssignments.userId, userId),
          eq(facilityAssignments.role, role),
          eq(users.role, role),
          eq(users.status, "ACTIVE"),
          eq(facilityAssignments.isActive, true),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
        ),
      )
      .for("share", { of: facilityAssignments });
    return Boolean(row);
  }

  async lockFacility(tx: ReturnTransaction, facilityId: string) {
    const [row] = await tx
      .select({ id: facilities.id })
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .for("update");
    if (!row) throw new NotFoundError(m.notFound);
  }

  async operatingHours(tx: ReturnTransaction | Database = this.db) {
    const rows = await tx
      .select({ key: systemSettings.key, value: systemSettingInteger })
      .from(systemSettings)
      .where(inArray(systemSettings.key, ["OPENING_HOUR", "CLOSING_HOUR"]));
    const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    if (settings.OPENING_HOUR === undefined || settings.CLOSING_HOUR === undefined) return [];
    return [
      {
        openTime: `${String(settings.OPENING_HOUR).padStart(2, "0")}:00:00`,
        closeTime: `${String(settings.CLOSING_HOUR).padStart(2, "0")}:00:00`,
        timezone: "Asia/Ho_Chi_Minh",
      },
    ];
  }
  requestsForRental(tx: ReturnTransaction, rentalId: string) {
    return tx
      .select()
      .from(returnRequests)
      .where(eq(returnRequests.rentalId, rentalId))
      .orderBy(desc(returnRequests.createdAt), desc(returnRequests.id));
  }
  queue(tx: ReturnTransaction, facilityId: string, query: ReturnQueueQuery, staffId?: string) {
    const today = sql<string>`(current_timestamp at time zone ${returnRequests.timezone})::date`;
    return tx
      .select()
      .from(returnRequests)
      .where(
        and(
          eq(returnRequests.facilityId, facilityId),
          query.status ? eq(returnRequests.status, query.status) : undefined,
          staffId ? eq(returnRequests.assignedStaffId, staffId) : undefined,
          gte(returnRequests.date, query.fromDate ?? query.toDate ?? today),
          lte(returnRequests.date, query.toDate ?? query.fromDate ?? today),
        ),
      )
      .orderBy(returnRequests.startsAt, returnRequests.id)
      .limit(query.limit)
      .offset(query.offset);
  }
  operationalContexts(tx: ReturnTransaction, requestIds: string[]) {
    return tx
      .select({
        requestId: returnRequests.id,
        bookingId: bookings.id,
        bookingCode: bookings.bookingCode,
        customerId: bookings.userId,
        customerName: bookingCustomer.name,
        customerPhone: bookings.contactPhone,
        rentalId: rentals.id,
        rentalStatus: rentals.status,
        expectedEndAt: rentals.expectedEndAt,
        depositAmount: rentals.depositAmount,
        unitId: storageUnits.id,
        unitCode: storageUnits.code,
        unitTypeName: unitTypes.name,
        sizeLabel: unitTypes.sizeLabel,
        facilityId: facilities.id,
        facilityName: facilities.name,
        staffId: users.id,
        staffName: users.name,
      })
      .from(returnRequests)
      .innerJoin(
        rentals,
        and(
          eq(rentals.id, returnRequests.rentalId),
          eq(rentals.facilityId, returnRequests.facilityId),
        ),
      )
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .innerJoin(bookingCustomer, eq(bookingCustomer.id, bookings.userId))
      .innerJoin(
        storageUnits,
        and(
          eq(storageUnits.id, rentals.physicalUnitId),
          eq(storageUnits.facilityId, returnRequests.facilityId),
        ),
      )
      .innerJoin(unitTypes, eq(unitTypes.id, storageUnits.unitTypeId))
      .innerJoin(facilities, eq(facilities.id, returnRequests.facilityId))
      .leftJoin(users, eq(users.id, returnRequests.assignedStaffId))
      .where(inArray(returnRequests.id, requestIds));
  }
  async checklist(tx: ReturnTransaction | Database = this.db) {
    const [row] = await tx
      .select()
      .from(returnChecklistVersions)
      .orderBy(desc(returnChecklistVersions.version))
      .limit(1);
    return row;
  }
  async saveChecklist(tx: ReturnTransaction, values: typeof returnChecklistVersions.$inferInsert) {
    const [row] = await tx.insert(returnChecklistVersions).values(values).returning();
    return row;
  }
  async lockChecklist(tx: ReturnTransaction) {
    // Serialize version creation even before the first row exists; no Drizzle advisory-lock helper.
    await tx.execute(sql`select pg_advisory_xact_lock(420217, 1)`);
  }
  async rate(tx: ReturnTransaction | Database = this.db) {
    const [row] = await tx
      .select({ rate: systemSettingInteger, version: systemSettings.version })
      .from(systemSettings)
      .where(eq(systemSettings.key, SystemSettingKey.OVERDUE_FEE_RATE));
    return row;
  }
  async lockRate(tx: ReturnTransaction) {
    const [row] = await tx
      .select({ rate: systemSettingInteger, version: systemSettings.version })
      .from(systemSettings)
      .where(eq(systemSettings.key, SystemSettingKey.OVERDUE_FEE_RATE))
      .for("update");
    return row;
  }
  async saveRate(
    tx: ReturnTransaction,
    rate: number,
    version: number,
    actorId: string,
    beforeRate: number,
  ) {
    await tx
      .update(systemSettings)
      .set({ value: rate, version, updatedBy: actorId, updatedAt: new Date() })
      .where(eq(systemSettings.key, SystemSettingKey.OVERDUE_FEE_RATE));
    await tx.insert(systemSettingChanges).values({
      key: SystemSettingKey.OVERDUE_FEE_RATE,
      before: { value: beforeRate, version: version - 1 },
      after: { value: rate, version },
      actorId,
      source: "OVERDUE_RATE_CONFIGURED",
    });
  }
  async audit(
    tx: ReturnTransaction,
    actorId: string | null,
    action: string,
    details: Record<string, unknown>,
    requestId: string | null = null,
    facilityId: string | null = null,
  ) {
    await tx.insert(returnAudit).values({ actorId, action, details, requestId, facilityId });
    const events = {
      RETURN_REQUEST_CREATED: "RETURN_CHANGED",
      RETURN_REQUEST_EDITED: "RETURN_CHANGED",
      RETURN_REQUEST_CANCELLED: "RETURN_CHANGED",
      RETURN_REQUEST_CONFIRMED: "RETURN_SCHEDULED",
      INSPECTION_COMPLETED: "RETURN_INSPECTION",
      SETTLEMENT_APPROVED: "RETURN_SETTLED",
      SETTLEMENT_ADJUSTED: "RETURN_SETTLED",
      MANUAL_REFUND_CONFIRMED: "RETURN_REFUND",
      RETURN_TIME_DECIDED: "RETURN_TIME_CHANGED",
    } as const;
    const type = events[action as keyof typeof events];
    if (!requestId || !type) return;
    const [request] = await tx
      .select()
      .from(returnRequests)
      .where(eq(returnRequests.id, requestId));
    if (!request) return;
    const [rental] = await tx.select().from(rentals).where(eq(rentals.id, request.rentalId));
    if (!rental) return;
    await recordLifecycleEvent(tx, {
      key: `return:${requestId}:${action}:${details.settlementId ?? details.refundId ?? details.inspectionId ?? details.changeId ?? request.version}`,
      type,
      bookingId: rental.bookingId,
      managers: true,
      detail: lifecycleReturnDetail(details),
    });
  }
  async schedule(tx: ReturnTransaction, facilityId: string, date: string) {
    const hours = await this.operatingHours(tx);
    const slots = await tx
      .select()
      .from(checkInSlots)
      .orderBy(checkInSlots.startTime, checkInSlots.id);
    const adjacent = [-1, 0, 1].map((offset) => {
      const day = new Date(`${date}T12:00:00Z`);
      day.setUTCDate(day.getUTCDate() + offset);
      return day.toISOString().slice(0, 10);
    });
    const appointments = await tx
      .select()
      .from(returnRequests)
      .where(
        and(
          eq(returnRequests.facilityId, facilityId),
          inArray(returnRequests.date, adjacent),
          inArray(returnRequests.status, ["CONFIRMED", "INSPECTING", "FAILED"]),
        ),
      );
    return { hours, slots, appointments };
  }
  async slotTimes(
    tx: ReturnTransaction,
    date: string,
    start: string,
    end: string,
    timezone: string,
  ) {
    // A scalar SELECT has no FROM table. PostgreSQL performs the IANA timezone/DST
    // conversion; Drizzle's select builder requires FROM, so use this small statement.
    const [row] = await tx.execute<{ startsAt: string; endsAt: string }>(sql`select
      (${date}::date + ${start}::time) at time zone ${timezone} as "startsAt",
      (${date}::date + ${end}::time) at time zone ${timezone} as "endsAt"`);
    if (!row) throw new NotFoundError(m.notFound);
    return { startsAt: new Date(row.startsAt), endsAt: new Date(row.endsAt) };
  }
  async openRequest(tx: ReturnTransaction, rentalId: string) {
    const [row] = await tx
      .select()
      .from(returnRequests)
      .where(
        and(
          eq(returnRequests.rentalId, rentalId),
          inArray(returnRequests.status, ["PENDING", "CONFIRMED", "INSPECTING", "FAILED"]),
        ),
      );
    return row;
  }
  async insertRequest(tx: ReturnTransaction, values: typeof returnRequests.$inferInsert) {
    const [row] = await tx.insert(returnRequests).values(values).returning();
    if (!row) throw new NotFoundError(m.notFound);
    return row;
  }
  async updateRequest(
    tx: ReturnTransaction,
    id: string,
    values: Partial<typeof returnRequests.$inferInsert>,
  ) {
    const [row] = await tx
      .update(returnRequests)
      .set({ ...values, version: sql`${returnRequests.version} + 1` })
      .where(eq(returnRequests.id, id))
      .returning();
    if (!row) throw new NotFoundError(m.notFound);
    return row;
  }
  updateRental(tx: ReturnTransaction, id: string, values: Partial<typeof rentals.$inferInsert>) {
    return tx
      .update(rentals)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(rentals.id, id));
  }
  async releaseOccupancy(tx: ReturnTransaction, bookingId: string, unitId: string, at: Date) {
    await tx
      .update(unitAssignments)
      .set({ status: "COMPLETED", endedAt: at })
      .where(
        and(
          eq(unitAssignments.bookingId, bookingId),
          eq(unitAssignments.physicalUnitId, unitId),
          eq(unitAssignments.status, "ACTIVE"),
        ),
      );
    await tx
      .update(capacityAllocations)
      .set({ status: "RELEASED", updatedAt: at })
      .where(
        and(
          eq(capacityAllocations.referenceId, bookingId),
          eq(capacityAllocations.kind, "BOOKING"),
          eq(capacityAllocations.status, "ACTIVE"),
        ),
      );
  }
  updateUnit(tx: ReturnTransaction, id: string, status: typeof storageUnits.$inferInsert.status) {
    return tx
      .update(storageUnits)
      .set({ status, updatedAt: new Date() })
      .where(eq(storageUnits.id, id));
  }
  async inspections(tx: ReturnTransaction | Database, requestId: string) {
    return tx
      .select()
      .from(returnInspections)
      .where(eq(returnInspections.requestId, requestId))
      .orderBy(desc(returnInspections.attempt));
  }
  async insertInspection(tx: ReturnTransaction, values: typeof returnInspections.$inferInsert) {
    const [row] = await tx.insert(returnInspections).values(values).returning();
    if (!row) throw new NotFoundError(m.notFound);
    return row;
  }
  async updateInspection(
    tx: ReturnTransaction,
    id: string,
    values: Partial<typeof returnInspections.$inferInsert>,
  ) {
    const [row] = await tx
      .update(returnInspections)
      .set({ ...values, version: sql`${returnInspections.version} + 1` })
      .where(eq(returnInspections.id, id))
      .returning();
    if (!row) throw new NotFoundError(m.notFound);
    return row;
  }
  photos(tx: ReturnTransaction | Database, inspectionId: string) {
    return tx
      .select()
      .from(returnInspectionPhotos)
      .where(eq(returnInspectionPhotos.inspectionId, inspectionId));
  }
  async insertPhoto(tx: ReturnTransaction, values: typeof returnInspectionPhotos.$inferInsert) {
    const [row] = await tx.insert(returnInspectionPhotos).values(values).returning();
    if (!row) throw new NotFoundError(m.notFound);
    return row;
  }
  evidence(tx: ReturnTransaction | Database, requestId: string) {
    return tx
      .select()
      .from(returnEvidencePhotos)
      .where(eq(returnEvidencePhotos.requestId, requestId));
  }
  async insertEvidence(tx: ReturnTransaction, values: typeof returnEvidencePhotos.$inferInsert) {
    const [row] = await tx.insert(returnEvidencePhotos).values(values).returning();
    if (!row) throw new NotFoundError(m.notFound);
    return row;
  }
  async timeChanges(tx: ReturnTransaction | Database, requestId: string) {
    return tx
      .select()
      .from(returnTimeChanges)
      .where(eq(returnTimeChanges.requestId, requestId))
      .orderBy(returnTimeChanges.createdAt, returnTimeChanges.id);
  }
  async insertTimeChange(tx: ReturnTransaction, values: typeof returnTimeChanges.$inferInsert) {
    const [row] = await tx.insert(returnTimeChanges).values(values).returning();
    if (!row) throw new NotFoundError(m.notFound);
    return row;
  }
  decideTime(
    tx: ReturnTransaction,
    id: string,
    values: Partial<typeof returnTimeChanges.$inferInsert>,
  ) {
    return tx.update(returnTimeChanges).set(values).where(eq(returnTimeChanges.id, id));
  }
  settlements(tx: ReturnTransaction | Database, requestId: string) {
    return tx
      .select()
      .from(returnSettlements)
      .where(eq(returnSettlements.requestId, requestId))
      .orderBy(desc(returnSettlements.revision));
  }
  async insertSettlement(tx: ReturnTransaction, values: typeof returnSettlements.$inferInsert) {
    const [row] = await tx.insert(returnSettlements).values(values).returning();
    if (!row) throw new NotFoundError(m.notFound);
    return row;
  }
  async syncReturnDebtCharge(
    tx: ReturnTransaction,
    settlement: typeof returnSettlements.$inferSelect,
    previous: typeof returnSettlements.$inferSelect | undefined,
    rentalId: string,
    actorId: string,
  ) {
    const debt = BigInt(settlement.debtAmount);
    const previousChargeId = previous?.rentalChargeId;
    const [previousCharge] = previousChargeId
      ? await tx
          .select()
          .from(rentalCharges)
          .where(eq(rentalCharges.id, previousChargeId))
          .for("update")
      : [];
    let chargeId: string | undefined;
    if (previousCharge) {
      const adjustments = await tx
        .select()
        .from(rentalChargeAdjustments)
        .where(eq(rentalChargeAdjustments.chargeId, previousCharge.id));
      const balance = adjustments.reduce(
        (value, item) => value + (item.direction === "INCREASE" ? 1n : -1n) * BigInt(item.amount),
        BigInt(previousCharge.amount),
      );
      const [captured] = await tx
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.rentalChargeId, previousCharge.id),
            inArray(payments.status, ["SUCCEEDED", "REFUND_PENDING", "REFUNDED"]),
          ),
        )
        .orderBy(desc(payments.paidAt), desc(payments.id))
        .limit(1);
      if (!captured) {
        const delta = debt - balance;
        if (delta !== 0n) {
          const direction = delta > 0n ? "INCREASE" : "REDUCTION";
          await tx.insert(rentalChargeAdjustments).values({
            chargeId: previousCharge.id,
            settlementId: settlement.id,
            direction,
            amount: (delta > 0n ? delta : -delta).toString(),
            reason: "Return settlement revision",
            createdBy: actorId,
          });
          await tx.insert(rentalChargeEvents).values({
            chargeId: previousCharge.id,
            type: "ADJUSTED",
            actorId,
            reason: "Return settlement revision",
            details: {
              settlementId: settlement.id,
              direction,
              amount: (delta > 0n ? delta : -delta).toString(),
            },
          });
        }
        await tx
          .update(rentalCharges)
          .set({ status: debt > 0n ? "OPEN" : "VOID", updatedAt: new Date() })
          .where(eq(rentalCharges.id, previousCharge.id));
        chargeId = previousCharge.id;
      } else {
        const priorRefunds = await tx
          .select()
          .from(rentalChargeRefunds)
          .where(
            and(
              eq(rentalChargeRefunds.chargeId, previousCharge.id),
              inArray(rentalChargeRefunds.status, ["PENDING", "CONFIRMED"]),
            ),
          );
        const confirmedRefund = priorRefunds.reduce(
          (sum, item) => sum + (item.status === "CONFIRMED" ? BigInt(item.amount) : 0n),
          0n,
        );
        const pendingRefund = priorRefunds.reduce(
          (sum, item) => sum + (item.status === "PENDING" ? BigInt(item.amount) : 0n),
          0n,
        );
        const netCollected = BigInt(captured.totalAmount) - confirmedRefund;
        if (debt >= netCollected) {
          if (pendingRefund > 0n) {
            await tx
              .update(rentalChargeRefunds)
              .set({ status: "CANCELLED" })
              .where(
                and(
                  eq(rentalChargeRefunds.chargeId, previousCharge.id),
                  eq(rentalChargeRefunds.status, "PENDING"),
                ),
              );
            await tx.insert(rentalChargeEvents).values({
              chargeId: previousCharge.id,
              type: "REFUND_CANCELLED",
              actorId,
              reason: "Return settlement revision changed the refundable balance",
              details: { settlementId: settlement.id },
            });
          }
          if (debt > netCollected) {
            const [extra] = await tx
              .insert(rentalCharges)
              .values({
                rentalId,
                source: "RETURN_DEBT",
                category: "RETURN_DEBT",
                amount: (debt - netCollected).toString(),
                evidence: "Additional amount from approved return settlement revision",
                dueDate: null,
                status: "OPEN",
                createdBy: actorId,
                approvedBy: actorId,
              })
              .returning();
            if (extra) {
              chargeId = extra.id;
              await tx.insert(rentalChargeEvents).values({
                chargeId: extra.id,
                type: "APPROVED",
                actorId,
                reason: "Additional return settlement debt",
              });
            }
          } else chargeId = previousCharge.id;
        } else {
          const targetRefund = BigInt(captured.totalAmount) - debt;
          const allocatedPending = targetRefund - confirmedRefund;
          if (pendingRefund > allocatedPending) {
            await tx
              .update(rentalChargeRefunds)
              .set({ status: "CANCELLED" })
              .where(
                and(
                  eq(rentalChargeRefunds.chargeId, previousCharge.id),
                  eq(rentalChargeRefunds.status, "PENDING"),
                ),
              );
            await tx.insert(rentalChargeEvents).values({
              chargeId: previousCharge.id,
              type: "REFUND_CANCELLED",
              actorId,
              reason: "Return settlement revision changed the pending refund",
              details: { settlementId: settlement.id },
            });
          }
          const allocated = pendingRefund > allocatedPending ? 0n : pendingRefund;
          const refundAmount = targetRefund - confirmedRefund - allocated;
          if (refundAmount > 0n) {
            await tx.insert(rentalChargeRefunds).values({
              chargeId: previousCharge.id,
              paymentId: captured.id,
              settlementId: settlement.id,
              amount: refundAmount.toString(),
              reason: "Return settlement correction",
            });
            await tx.insert(rentalChargeEvents).values({
              chargeId: previousCharge.id,
              type: "REFUND_CREATED",
              actorId,
              reason: "Return settlement correction",
              details: { settlementId: settlement.id, amount: refundAmount.toString() },
            });
          }
          await tx
            .update(rentalCharges)
            .set({ status: "REFUND_DUE", updatedAt: new Date() })
            .where(eq(rentalCharges.id, previousCharge.id));
          chargeId = previousCharge.id;
        }
      }
    } else if (debt > 0n) {
      const [created] = await tx
        .insert(rentalCharges)
        .values({
          rentalId,
          source: "RETURN_DEBT",
          category: "RETURN_DEBT",
          amount: debt.toString(),
          evidence: "Approved return settlement debt",
          dueDate: null,
          status: "OPEN",
          createdBy: actorId,
          approvedBy: actorId,
        })
        .returning();
      if (created) {
        chargeId = created.id;
        await tx.insert(rentalChargeEvents).values({
          chargeId: created.id,
          type: "APPROVED",
          actorId,
          reason: "Approved return settlement debt",
        });
      }
    }
    if (chargeId)
      await tx
        .update(returnSettlements)
        .set({ rentalChargeId: chargeId })
        .where(eq(returnSettlements.id, settlement.id));
  }
  refunds(tx: ReturnTransaction | Database, requestId: string) {
    return tx.select().from(returnRefunds).where(eq(returnRefunds.requestId, requestId));
  }
  async payment(tx: ReturnTransaction, bookingId: string) {
    const [row] = await tx
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.bookingId, bookingId),
          inArray(payments.status, ["SUCCEEDED", "REFUND_PENDING", "REFUNDED"]),
        ),
      )
      .orderBy(payments.paidAt, payments.id)
      .limit(1);
    return row;
  }
  async insertRefund(tx: ReturnTransaction, values: typeof returnRefunds.$inferInsert) {
    const [row] = await tx.insert(returnRefunds).values(values).onConflictDoNothing().returning();
    return row;
  }
  auditHistory(tx: ReturnTransaction, requestId: string) {
    return tx
      .select()
      .from(returnAudit)
      .where(eq(returnAudit.requestId, requestId))
      .orderBy(returnAudit.createdAt, returnAudit.id);
  }
}
