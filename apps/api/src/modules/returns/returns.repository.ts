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
  facilityOperatingHours,
  facilityReturnCalendars,
  gt,
  inArray,
  isNull,
  or,
  payments,
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
  users,
} from "@metastorage/database";
import { NotFoundError } from "../../common/errors/app-error";
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
      .for("share");
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

  async calendar(facilityId: string, tx: ReturnTransaction | Database = this.db) {
    const [row] = await tx
      .select()
      .from(facilityReturnCalendars)
      .where(eq(facilityReturnCalendars.facilityId, facilityId));
    return row;
  }
  hours(facilityId: string, tx: ReturnTransaction | Database = this.db) {
    return tx
      .select({
        dayOfWeek: facilityOperatingHours.dayOfWeek,
        openTime: facilityOperatingHours.openTime,
        closeTime: facilityOperatingHours.closeTime,
        timezone: facilityOperatingHours.timezone,
      })
      .from(facilityOperatingHours)
      .where(eq(facilityOperatingHours.facilityId, facilityId))
      .orderBy(facilityOperatingHours.dayOfWeek);
  }
  async saveHours(
    tx: ReturnTransaction,
    facilityId: string,
    timezone: string,
    hours: { dayOfWeek: number; openTime: string; closeTime: string }[],
  ) {
    await tx
      .delete(facilityOperatingHours)
      .where(eq(facilityOperatingHours.facilityId, facilityId));
    if (hours.length)
      await tx
        .insert(facilityOperatingHours)
        .values(hours.map((h) => ({ ...h, facilityId, timezone })));
  }
  requestsForRental(tx: ReturnTransaction, rentalId: string) {
    return tx
      .select()
      .from(returnRequests)
      .where(eq(returnRequests.rentalId, rentalId))
      .orderBy(desc(returnRequests.createdAt), desc(returnRequests.id));
  }
  queue(tx: ReturnTransaction, facilityId: string, query: ReturnQueueQuery, staffId?: string) {
    return tx
      .select()
      .from(returnRequests)
      .where(
        and(
          eq(returnRequests.facilityId, facilityId),
          query.status ? eq(returnRequests.status, query.status) : undefined,
          staffId ? eq(returnRequests.assignedStaffId, staffId) : undefined,
        ),
      )
      .orderBy(desc(returnRequests.createdAt), desc(returnRequests.id))
      .limit(query.limit)
      .offset(query.offset);
  }
  async saveCalendar(tx: ReturnTransaction, values: typeof facilityReturnCalendars.$inferInsert) {
    const [row] = await tx
      .insert(facilityReturnCalendars)
      .values(values)
      .onConflictDoUpdate({
        target: facilityReturnCalendars.facilityId,
        set: values,
      })
      .returning();
    return row;
  }
  async flagAppointments(tx: ReturnTransaction, facilityId: string) {
    await tx
      .update(returnRequests)
      .set({ manualReviewRequired: true, version: sql`${returnRequests.version} + 1` })
      .where(
        and(eq(returnRequests.facilityId, facilityId), eq(returnRequests.status, "CONFIRMED")),
      );
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
    actorId: string,
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
    const localNoon = new Date(`${date}T12:00:00Z`);
    const hours = await tx
      .select()
      .from(facilityOperatingHours)
      .where(
        and(
          eq(facilityOperatingHours.facilityId, facilityId),
          eq(facilityOperatingHours.dayOfWeek, localNoon.getUTCDay()),
        ),
      );
    const slots = await tx
      .select()
      .from(checkInSlots)
      .orderBy(checkInSlots.startTime, checkInSlots.id);
    const adjacent = [-1, 0, 1].map((offset) => {
      const day = new Date(localNoon);
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
