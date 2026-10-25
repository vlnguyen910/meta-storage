import { createHash } from "node:crypto";
import type {
  CheckInVerification,
  Database,
  Facility,
  Payment,
  SQL,
  StorageUnit,
  UnitAssignment,
  UnitType,
} from "@metastorage/database";
import {
  and,
  bookings,
  checkInSlots,
  checkInVerifications,
  desc,
  eq,
  facilities,
  inArray,
  max,
  payments,
  sql,
  storageUnits,
  unitAssignments,
  unitTypes,
} from "@metastorage/database";
import { bookingCustomer, bookingReadFields } from "../bookings/bookings.projection";
import { closeBookingBeforeCheckIn } from "../bookings/bookings.repository";
import type { BookingReadRecord } from "../bookings/bookings.types";
import { assertAssignedStaff } from "./check-in-access";
import type { CheckInPolicyEvaluation } from "./check-ins.policy";

type QueryExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export type CheckInRecord = {
  booking: BookingReadRecord;
  facility: Facility;
  unitType: UnitType;
  payment: Payment | null;
  assignment: UnitAssignment | null;
  assignedUnit: StorageUnit | null;
  verification: CheckInVerification | null;
  checkInDayEnd: Date | null;
};

type CheckInConfirmResult =
  | { kind: "VERIFIED"; record: CheckInRecord }
  | { kind: "INELIGIBLE"; record: CheckInRecord; evaluation: CheckInPolicyEvaluation }
  | { kind: "NO_SHOW"; record: CheckInRecord };

function hashQrToken(qrToken: string): string {
  return createHash("sha256").update(qrToken).digest("hex");
}

function normalizedBookingCode(value: string): string {
  return value.trim().toUpperCase();
}

export class CheckInsRepository {
  constructor(private readonly db: Database) {}

  private async selectRecord(
    executor: QueryExecutor,
    condition: SQL<unknown>,
  ): Promise<CheckInRecord | null> {
    const [row] = await executor
      .select({
        booking: bookingReadFields,
        facility: facilities,
        unitType: unitTypes,
        payment: payments,
        assignment: unitAssignments,
        assignedUnit: storageUnits,
        verification: checkInVerifications,
        checkInDayEnd: sql<Date | null>`(${bookings.checkInDate} +
          (${executor.select({ end: max(checkInSlots.endTime) }).from(checkInSlots)}))
          at time zone 'Asia/Ho_Chi_Minh'`.mapWith((value) =>
          value === null ? null : new Date(value),
        ),
      })
      .from(bookings)
      .innerJoin(bookingCustomer, eq(bookingCustomer.id, bookings.userId))
      .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
      .innerJoin(unitTypes, eq(bookings.unitTypeId, unitTypes.id))
      .leftJoin(payments, eq(payments.bookingId, bookings.id))
      .leftJoin(
        unitAssignments,
        and(eq(unitAssignments.bookingId, bookings.id), eq(unitAssignments.status, "ACTIVE")),
      )
      .leftJoin(storageUnits, eq(unitAssignments.physicalUnitId, storageUnits.id))
      .leftJoin(
        checkInVerifications,
        and(
          eq(checkInVerifications.bookingId, bookings.id),
          inArray(checkInVerifications.status, ["VERIFIED", "CONSUMED"]),
        ),
      )
      .where(condition)
      .orderBy(desc(payments.createdAt))
      .limit(1);

    return row ?? null;
  }

  async findFacilityIdByLookup(type: "QR_TOKEN" | "BOOKING_CODE", value: string) {
    const condition =
      type === "QR_TOKEN"
        ? eq(bookings.qrTokenHash, hashQrToken(value.trim()))
        : eq(bookings.bookingCode, normalizedBookingCode(value));
    const [row] = await this.db
      .select({ facilityId: bookings.facilityId })
      .from(bookings)
      .where(condition);
    return row?.facilityId ?? null;
  }

  async findByLookup(
    type: "QR_TOKEN" | "BOOKING_CODE",
    value: string,
  ): Promise<CheckInRecord | null> {
    const condition =
      type === "QR_TOKEN"
        ? eq(bookings.qrTokenHash, hashQrToken(value.trim()))
        : eq(bookings.bookingCode, normalizedBookingCode(value));
    return this.selectRecord(this.db, condition);
  }

  async findFacilityIdByBookingId(bookingId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ facilityId: bookings.facilityId })
      .from(bookings)
      .where(eq(bookings.id, bookingId));
    return row?.facilityId ?? null;
  }

  async findByBookingId(bookingId: string): Promise<CheckInRecord | null> {
    return this.selectRecord(this.db, eq(bookings.id, bookingId));
  }

  async confirmVerification(
    bookingId: string,
    staffId: string,
    now: Date,
    evaluate: (record: CheckInRecord, now: Date) => CheckInPolicyEvaluation,
  ): Promise<CheckInConfirmResult | null> {
    return this.db.transaction(async (tx) => {
      const [lockedBooking] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .for("update");
      if (!lockedBooking) return null;

      let record = await this.selectRecord(tx, eq(bookings.id, bookingId));
      if (!record) return null;

      if (staffId !== "system-check-in-expiry")
        assertAssignedStaff(
          { id: staffId, role: "FACILITY_STAFF" },
          record.booking.assignedStaffId,
        );
      const evaluation = evaluate(record, now);
      if (evaluation.shouldMarkNoShow) {
        const closed = await closeBookingBeforeCheckIn(tx, bookingId, "NO_SHOW", now);
        if (!closed) return { kind: "INELIGIBLE", record, evaluation };

        record = await this.selectRecord(tx, eq(bookings.id, bookingId));
        if (!record) return null;
        return { kind: "NO_SHOW", record };
      }

      if (!evaluation.canProceed || !record.assignment) {
        return { kind: "INELIGIBLE", record, evaluation };
      }

      const existingVerification = record.verification;
      if (
        existingVerification &&
        existingVerification.staffId === staffId &&
        existingVerification.unitAssignmentId === record.assignment.id
      ) {
        return { kind: "VERIFIED", record };
      }

      await tx
        .update(checkInVerifications)
        .set({
          status: "INVALIDATED",
          invalidatedAt: now,
          invalidatedReason: "Tạo verification mới cho booking",
          updatedAt: now,
        })
        .where(
          and(
            eq(checkInVerifications.bookingId, bookingId),
            eq(checkInVerifications.status, "VERIFIED"),
          ),
        );

      const [verification] = await tx
        .insert(checkInVerifications)
        .values({
          bookingId,
          facilityId: record.booking.facilityId,
          staffId,
          unitAssignmentId: record.assignment.id,
          status: "VERIFIED",
          verifiedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!verification) throw new Error("Failed to create check-in verification");
      record = { ...record, verification };
      return { kind: "VERIFIED", record };
    });
  }
}
