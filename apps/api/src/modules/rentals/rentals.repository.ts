import type { RentalDetail, RentalListItem, RentalPageQuery } from "@metastorage/contracts";
import {
  and,
  asc,
  bookings,
  type Database,
  eq,
  facilities,
  gt,
  inArray,
  or,
  payments,
  rentals,
  returnRefunds,
  sql,
  storageUnits,
  unitTypes,
} from "@metastorage/database";

import { bookingReadFields } from "../bookings/bookings.projection";
import type { BookingReadRecord } from "../bookings/bookings.types";

const ACTIONS = {
  canCancel: false as const,
  canReschedule: false as const,
  note: "Các thao tác hủy, đổi lịch và yêu cầu hoàn tiền sẽ được bổ sung ở phiên bản sau.",
};

export class RentalsRepository {
  constructor(private readonly db: Database) {}

  private baseQuery() {
    return this.db
      .select({
        rental: rentals,
        booking: bookingReadFields,
        facility: facilities,
        unitType: unitTypes,
        physicalUnit: storageUnits,
        // Date drops microseconds. Keep an exact UTC cursor with PostgreSQL formatting,
        // for which Drizzle has no helper, so equal-expiry pages never repeat rows.
        cursorEndAt: sql<string>`to_char(${rentals.expectedEndAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      })
      .from(rentals)
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .innerJoin(facilities, eq(facilities.id, rentals.facilityId))
      .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
      .leftJoin(storageUnits, eq(storageUnits.id, rentals.physicalUnitId));
  }

  async listByUserId(userId: string): Promise<RentalListItem[]> {
    const rows = await this.baseQuery()
      .where(
        and(
          eq(bookings.userId, userId),
          inArray(rentals.status, ["ACTIVE", "RETURN_PENDING", "OVERDUE"]),
        ),
      )
      .orderBy(asc(rentals.expectedEndAt), asc(rentals.id));
    return rows.map(toListItem);
  }

  async listPageByUserId(userId: string, query: RentalPageQuery, history: boolean) {
    const afterEndAt = query.afterEndAt ? sql`${query.afterEndAt}::timestamptz` : undefined;
    return this.baseQuery()
      .where(
        and(
          eq(bookings.userId, userId),
          inArray(rentals.status, history ? ["CLOSED"] : ["ACTIVE", "RETURN_PENDING", "OVERDUE"]),
          afterEndAt && query.afterId
            ? or(
                gt(rentals.expectedEndAt, afterEndAt),
                and(eq(rentals.expectedEndAt, afterEndAt), gt(rentals.id, query.afterId)),
              )
            : undefined,
        ),
      )
      .orderBy(asc(rentals.expectedEndAt), asc(rentals.id))
      .limit(query.limit + 1);
  }

  async listPaymentsByUserId(rentalId: string, userId: string) {
    return this.db
      .select({
        id: payments.id,
        paymentCode: payments.paymentCode,
        provider: payments.provider,
        status: payments.status,
        totalAmount: payments.totalAmount,
        currency: payments.currency,
        paidAt: payments.paidAt,
        refundAmount: payments.refundAmount,
        refundReason: payments.refundReason,
        refundedAt: payments.refundedAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .innerJoin(rentals, eq(rentals.bookingId, bookings.id))
      .where(and(eq(rentals.id, rentalId), eq(bookings.userId, userId)))
      .orderBy(asc(payments.createdAt), asc(payments.id));
  }

  listReturnRefundsByUserId(rentalId: string, userId: string) {
    return this.db
      .select({
        id: returnRefunds.id,
        paymentId: returnRefunds.paymentId,
        amount: returnRefunds.amount,
        reference: returnRefunds.reference,
        confirmedAt: returnRefunds.confirmedAt,
        settlementId: returnRefunds.settlementId,
      })
      .from(returnRefunds)
      .innerJoin(payments, eq(payments.id, returnRefunds.paymentId))
      .innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .innerJoin(rentals, eq(rentals.bookingId, bookings.id))
      .where(and(eq(rentals.id, rentalId), eq(bookings.userId, userId)))
      .orderBy(asc(returnRefunds.confirmedAt), asc(returnRefunds.id));
  }

  async findByIdAndUserId(rentalId: string, userId: string): Promise<RentalDetail | null> {
    const [row] = await this.baseQuery().where(
      and(eq(rentals.id, rentalId), eq(bookings.userId, userId)),
    );
    return row ? toDetail(row) : null;
  }
}

type RentalRow = Awaited<ReturnType<RentalsRepository["listByUserId"]>>[number] extends never
  ? never
  : {
      rental: typeof rentals.$inferSelect;
      booking: BookingReadRecord;
      facility: typeof facilities.$inferSelect;
      unitType: typeof unitTypes.$inferSelect;
      physicalUnit: typeof storageUnits.$inferSelect | null;
    };

export function toListItem(row: RentalRow): RentalListItem {
  return {
    id: row.rental.id,
    bookingId: row.booking.id,
    bookingCode: row.booking.bookingCode ?? row.booking.id.slice(0, 8).toUpperCase(),
    facility: { id: row.facility.id, name: row.facility.name, address: row.facility.address },
    unitType: { id: row.unitType.id, name: row.unitType.name, sizeLabel: row.unitType.sizeLabel },
    physicalUnit: row.physicalUnit
      ? { id: row.physicalUnit.id, code: row.physicalUnit.code }
      : null,
    startAt: row.rental.startAt.toISOString(),
    expectedEndAt: row.rental.expectedEndAt.toISOString(),
    status: row.rental.status,
    bookingStatus: row.booking.status,
    actions: ACTIONS,
  };
}

function toDetail(row: RentalRow): RentalDetail {
  const item = toListItem(row);
  return {
    ...item,
    actualReturnAt: row.rental.actualReturnAt?.toISOString() ?? null,
    closedAt: row.rental.closedAt?.toISOString() ?? null,
    depositAmount: row.rental.depositAmount,
    checkInSlotStart: row.booking.checkInSlotStart.toISOString(),
    checkInSlotEnd: row.booking.checkInSlotEnd?.toISOString() ?? null,
    timeline: [
      { label: "Booking confirmed", status: "DONE", at: row.booking.paidAt?.toISOString() ?? null },
      {
        label: "Check-in",
        status: row.rental.status === "ACTIVE" ? "CURRENT" : "DONE",
        at: row.booking.checkInSlotStart.toISOString(),
      },
      {
        label: "Return",
        status: row.rental.closedAt ? "DONE" : "UPCOMING",
        at: row.rental.expectedEndAt.toISOString(),
      },
    ],
  };
}
