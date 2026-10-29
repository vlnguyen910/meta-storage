import { createHash } from "node:crypto";
import type {
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
  desc,
  eq,
  facilities,
  payments,
  storageUnits,
  unitAssignments,
  unitTypes,
} from "@metastorage/database";
import { bookingCustomer, bookingReadFields } from "../bookings/bookings.projection";
import type { BookingReadRecord } from "../bookings/bookings.types";
import type { BookingTransaction } from "./bookings.types";

type QueryExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export type CheckInRecord = {
  booking: BookingReadRecord;
  facility: Facility;
  unitType: UnitType;
  payment: Payment | null;
  assignment: UnitAssignment | null;
  assignedUnit: StorageUnit | null;
};

function hashQrToken(qrToken: string): string {
  return createHash("sha256").update(qrToken).digest("hex");
}

function normalizedBookingCode(value: string): string {
  return value.trim().toUpperCase();
}

export class BookingCheckInRepository {
  constructor(private readonly db: Database) {}

  transaction<T>(callback: (tx: BookingTransaction) => Promise<T>) {
    return this.db.transaction(callback);
  }

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

  async findByBookingId(bookingId: string): Promise<CheckInRecord | null> {
    return this.selectRecord(this.db, eq(bookings.id, bookingId));
  }
}
