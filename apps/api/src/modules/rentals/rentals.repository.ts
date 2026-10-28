import type {
  FacilityRentalHistoryQuery,
  FacilityRentalListQuery,
  RentalDetail,
  RentalListItem,
  RentalPageQuery,
} from "@metastorage/contracts";
import {
  and,
  asc,
  bookings,
  count,
  type Database,
  desc,
  eq,
  facilities,
  gt,
  inArray,
  isNotNull,
  or,
  payments,
  rentalChargeRefunds,
  rentalCharges,
  rentalRenewals,
  rentals,
  returnRefunds,
  sql,
  storageUnits,
  unitTypes,
} from "@metastorage/database";

import { bookingCustomer, bookingReadFields } from "../bookings/bookings.projection";
import type { BookingReadRecord } from "../bookings/bookings.types";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import type { RentalReadExecutor } from "./rentals.types";

const ACTIONS = {
  canCancel: false as const,
  canReschedule: false as const,
  note: "Các thao tác hủy, đổi lịch và yêu cầu hoàn tiền sẽ được bổ sung ở phiên bản sau.",
};

export class RentalsRepository {
  constructor(private readonly db: Database) {}

  findByBookingId(executor: RentalReadExecutor, bookingId: string) {
    return executor.select().from(rentals).where(eq(rentals.bookingId, bookingId)).limit(1);
  }

  managerAssignment(facilityId: string, userId: string) {
    return new FacilityAssignmentsRepository(this.db).findActiveAssignment(
      facilityId,
      userId,
      "FACILITY_MANAGER",
    );
  }

  private facilityQuery(executor: RentalReadExecutor = this.db) {
    const initialPayment = executor
      .selectDistinctOn([payments.bookingId], {
        bookingId: payments.bookingId,
        id: payments.id,
        status: payments.status,
        amount: payments.totalAmount,
        currency: payments.currency,
        paidAt: payments.paidAt,
      })
      .from(payments)
      .where(isNotNull(payments.bookingId))
      .orderBy(
        payments.bookingId,
        desc(isNotNull(payments.paidAt)),
        desc(payments.createdAt),
        desc(payments.id),
      )
      .as("rental_initial_payment");
    return executor
      .select({
        rental: rentals,
        booking: {
          id: bookings.id,
          bookingCode: bookings.bookingCode,
          userId: bookings.userId,
          name: bookingCustomer.name,
          email: bookingCustomer.email,
          phone: bookings.contactPhone,
        },
        unit: {
          id: storageUnits.id,
          code: storageUnits.code,
          unitTypeId: unitTypes.id,
          unitTypeName: unitTypes.name,
          sizeLabel: unitTypes.sizeLabel,
        },
        initialPayment: {
          id: initialPayment.id,
          status: initialPayment.status,
          amount: initialPayment.amount,
          currency: initialPayment.currency,
          paidAt: initialPayment.paidAt,
        },
      })
      .from(rentals)
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .innerJoin(bookingCustomer, eq(bookingCustomer.id, bookings.userId))
      .innerJoin(storageUnits, eq(storageUnits.id, rentals.physicalUnitId))
      .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
      .leftJoin(initialPayment, eq(initialPayment.bookingId, bookings.id));
  }

  listForFacility(facilityId: string, query: FacilityRentalListQuery) {
    return this.db.transaction(
      async (tx) => {
        const filter = and(
          eq(rentals.facilityId, facilityId),
          query.status ? eq(rentals.status, query.status) : undefined,
          query.unitTypeId ? eq(bookings.unitTypeId, query.unitTypeId) : undefined,
        );
        const [total] = await tx
          .select({ value: count() })
          .from(rentals)
          .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
          .where(filter);
        const items = await this.facilityQuery(tx)
          .where(filter)
          .orderBy(asc(rentals.expectedEndAt), asc(rentals.id))
          .limit(query.limit)
          .offset(query.offset);
        return { items, total: total?.value ?? 0 };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async findForFacility(facilityId: string, rentalId: string) {
    const [row] = await this.facilityQuery().where(
      and(eq(rentals.facilityId, facilityId), eq(rentals.id, rentalId)),
    );
    return row;
  }

  facilityPayments(bookingId: string, rentalId: string, query: FacilityRentalHistoryQuery) {
    return this.db.transaction(
      async (tx) => {
        const filter = or(eq(payments.bookingId, bookingId), eq(rentalCharges.rentalId, rentalId));
        const [total] = await tx
          .select({ value: count() })
          .from(payments)
          .leftJoin(rentalCharges, eq(rentalCharges.id, payments.rentalChargeId))
          .where(filter);
        const items = await tx
          .select({
            id: payments.id,
            paymentCode: payments.paymentCode,
            chargeId: payments.rentalChargeId,
            source: rentalCharges.source,
            status: payments.status,
            amount: payments.totalAmount,
            currency: payments.currency,
            paidAt: payments.paidAt,
            refundAmount: payments.refundAmount,
            refundReason: payments.refundReason,
            refundedAt: payments.refundedAt,
            createdAt: payments.createdAt,
          })
          .from(payments)
          .leftJoin(rentalCharges, eq(rentalCharges.id, payments.rentalChargeId))
          .where(filter)
          .orderBy(desc(payments.createdAt), desc(payments.id))
          .limit(query.limit)
          .offset(query.offset);
        const ids = items.map((item) => item.id);
        const returnTransfers = await tx
          .select({
            id: returnRefunds.id,
            paymentId: returnRefunds.paymentId,
            amount: returnRefunds.amount,
            reference: returnRefunds.reference,
            confirmedAt: returnRefunds.confirmedAt,
          })
          .from(returnRefunds)
          .where(inArray(returnRefunds.paymentId, ids))
          .orderBy(asc(returnRefunds.confirmedAt), asc(returnRefunds.id));
        const chargeTransfers = await tx
          .select({
            id: rentalChargeRefunds.id,
            paymentId: rentalChargeRefunds.paymentId,
            amount: rentalChargeRefunds.amount,
            reference: rentalChargeRefunds.reference,
            confirmedAt: rentalChargeRefunds.confirmedAt,
          })
          .from(rentalChargeRefunds)
          .where(
            and(
              inArray(rentalChargeRefunds.paymentId, ids),
              eq(rentalChargeRefunds.status, "CONFIRMED"),
            ),
          )
          .orderBy(asc(rentalChargeRefunds.confirmedAt), asc(rentalChargeRefunds.id));
        return { items, total: total?.value ?? 0, returnTransfers, chargeTransfers };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  facilityRenewals(rentalId: string, query: FacilityRentalHistoryQuery) {
    return this.db.transaction(
      async (tx) => {
        const filter = eq(rentalRenewals.rentalId, rentalId);
        const [total] = await tx.select({ value: count() }).from(rentalRenewals).where(filter);
        const items = await tx
          .select()
          .from(rentalRenewals)
          .where(filter)
          .orderBy(desc(rentalRenewals.createdAt), desc(rentalRenewals.id))
          .limit(query.limit)
          .offset(query.offset);
        return { items, total: total?.value ?? 0 };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

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
      .innerJoin(bookingCustomer, eq(bookingCustomer.id, bookings.userId))
      .innerJoin(facilities, eq(facilities.id, rentals.facilityId))
      .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
      .leftJoin(storageUnits, eq(storageUnits.id, rentals.physicalUnitId));
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
        chargeId: payments.rentalChargeId,
        source: rentalCharges.source,
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
      .leftJoin(rentalCharges, eq(rentalCharges.id, payments.rentalChargeId))
      .innerJoin(
        rentals,
        or(eq(rentals.bookingId, payments.bookingId), eq(rentals.id, rentalCharges.rentalId)),
      )
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .where(and(eq(rentals.id, rentalId), eq(bookings.userId, userId)))
      .orderBy(asc(payments.createdAt), asc(payments.id));
  }

  listChargeRefundsByUserId(rentalId: string, userId: string) {
    return this.db
      .select({
        id: rentalChargeRefunds.id,
        paymentId: rentalChargeRefunds.paymentId,
        amount: rentalChargeRefunds.amount,
        reference: rentalChargeRefunds.reference,
        confirmedAt: rentalChargeRefunds.confirmedAt,
      })
      .from(rentalChargeRefunds)
      .innerJoin(rentalCharges, eq(rentalCharges.id, rentalChargeRefunds.chargeId))
      .innerJoin(rentals, eq(rentals.id, rentalCharges.rentalId))
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .where(
        and(
          eq(rentals.id, rentalId),
          eq(bookings.userId, userId),
          eq(rentalChargeRefunds.status, "CONFIRMED"),
        ),
      )
      .orderBy(asc(rentalChargeRefunds.confirmedAt), asc(rentalChargeRefunds.id));
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

type RentalRow = {
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
