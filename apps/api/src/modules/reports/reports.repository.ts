import { REPORT_MESSAGES as m, type RentalReportQuery } from "@metastorage/contracts";
import {
  and,
  asc,
  bookings,
  capacityAllocations,
  count,
  type Database,
  eq,
  facilities,
  gt,
  gte,
  inArray,
  inspections,
  isNull,
  notExists,
  or,
  payments,
  policyViolationFees,
  type RentalStatus,
  ReservationStatus,
  rentals,
  reservations,
  type SQL,
  sql,
  storageUnits,
  unitTypes,
} from "@metastorage/database";
import { ForbiddenError } from "../../common/errors/app-error";
import { getFacilityAccessScope } from "../facilities/facilities.access";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import type { ReportActor, ReportFilters, ReportTransaction } from "./reports.types";

const amount = (condition: SQL, value: SQL) =>
  sql<string>`coalesce(sum(case when ${condition} then ${value} else 0 end), 0)::text`;
const quantity = (condition: SQL) =>
  sql<number>`count(case when ${condition} then 1 end)`.mapWith(Number);

const paymentFacilityId = sql<
  string | null
>`coalesce(${bookings.facilityId}, ${reservations.facilityId})`;
const paymentUnitTypeId = sql<
  string | null
>`coalesce(${bookings.unitTypeId}, ${reservations.unitTypeId})`;
const rentalSnapshot = sql`coalesce(${bookings.rentalFeeAmount}, ${reservations.rentalFeeAmount})`;
const depositSnapshot = sql`coalesce(${bookings.depositAmount}, ${reservations.depositAmount})`;

function financialRules(asOf: Date) {
  const vn = sql`${payments.currency} = 'VND'`;
  const captured = sql`${payments.type} = 'CHARGE' and ${payments.paidAt} is not null and ${payments.paidAt} <= ${asOf.toISOString()}`;
  const known = sql`${rentalSnapshot} >= 0 and ${depositSnapshot} >= 0 and ${payments.totalAmount} = ${rentalSnapshot} + ${depositSnapshot} and ${payments.depositForfeitedAmount} <= ${depositSnapshot}`;
  const refund = sql`case when ${payments.type} = 'DEPOSIT_REFUND' then ${payments.totalAmount} else coalesce(${payments.refundAmount}, ${payments.totalAmount}) end`;
  const settledRefund = sql`${payments.status} = 'REFUNDED' and ${payments.refundedAt} is not null and ${payments.refundedAt} <= ${asOf.toISOString()}`;
  const knownRefund = sql`${settledRefund} and (${refund} = ${payments.totalAmount} or (${refund} = ${rentalSnapshot} and ${payments.depositForfeitedAmount} = ${depositSnapshot}))`;
  const notReturned = notExists(
    sql`(select 1 from ${rentals} where ${rentals.status} = 'CLOSED' and ((${rentals.bookingId} is not null and ${rentals.bookingId} = ${payments.bookingId}) or (${rentals.reservationId} is not null and ${rentals.reservationId} = ${payments.reservationId})))`,
  );
  const legacyHeldKnown = sql`coalesce((${known} and (${payments.status} = 'SUCCEEDED' or ((${payments.status} = 'REFUND_PENDING' or (${knownRefund})) and ${refund} + ${payments.depositForfeitedAmount} <= ${payments.totalAmount}))), false)`;
  const knownSnapshot = sql`coalesce((${known}), false)`;
  return {
    vn,
    captured,
    refund,
    settledRefund,
    heldKnown: legacyHeldKnown,
    knownSnapshot,
    notReturned,
  };
}

export class ReportsRepository {
  constructor(private readonly db: Database) {}

  private async scope(tx: ReportTransaction, actor: ReportActor, filter: ReportFilters) {
    const scope = getFacilityAccessScope(actor);
    if (scope.kind === "assigned" && scope.role !== "FACILITY_MANAGER")
      throw new ForbiddenError(m.roleDenied);
    const assigned =
      scope.kind === "assigned"
        ? new FacilityAssignmentsRepository(this.db).activeAssignmentExists(facilities.id, scope)
        : undefined;
    const rows = await tx
      .select({
        id: facilities.id,
        code: facilities.code,
        name: facilities.name,
        isActive: facilities.isActive,
      })
      .from(facilities)
      .where(and(assigned, filter.facilityId ? eq(facilities.id, filter.facilityId) : undefined))
      .orderBy(asc(facilities.code));
    if (scope.kind === "assigned" && !rows.length) throw new ForbiddenError(m.scopeDenied);
    return {
      facilities: rows,
      ids: rows.map((row) => row.id),
      includeUnattributed: scope.kind === "global" && !filter.facilityId && !filter.unitTypeId,
    };
  }

  async read(
    actor: ReportActor,
    filter: ReportFilters,
    start: Date,
    end: Date,
    asOf: Date,
    metrics: "all" | "financial" | "inventory" = "all",
  ) {
    return this.db.transaction(
      async (tx) => {
        const scoped = await this.scope(tx, actor, filter);
        const { vn, captured, refund, settledRefund, heldKnown, knownSnapshot, notReturned } =
          financialRules(asOf);
        const inPeriod = sql`${captured} and ${payments.paidAt} >= ${start.toISOString()} and ${payments.paidAt} < ${end.toISOString()}`;
        const refundInPeriod = sql`${settledRefund} and ${payments.refundedAt} >= ${start.toISOString()} and ${payments.refundedAt} < ${end.toISOString()}`;
        const scopedPayment = and(
          or(
            inArray(paymentFacilityId, scoped.ids),
            scoped.includeUnattributed ? isNull(paymentFacilityId) : undefined,
          ),
        );
        const financial =
          metrics !== "inventory"
            ? await tx
                .select({
                  facilityId: paymentFacilityId,
                  cashReceived: amount(sql`${vn} and ${inPeriod}`, sql`${payments.totalAmount}`),
                  rentalCollected: amount(
                    sql`${vn} and ${inPeriod} and ${knownSnapshot}`,
                    sql`${rentalSnapshot}`,
                  ),
                  depositCollected: amount(
                    sql`${vn} and ${inPeriod} and ${knownSnapshot}`,
                    sql`${depositSnapshot}`,
                  ),
                  cashRefunded: amount(sql`${vn} and ${refundInPeriod}`, refund),
                  depositHeld: amount(
                    sql`${vn} and ${captured} and ${heldKnown} and ${notReturned} and ${payments.status} <> 'REFUNDED'`,
                    sql`${depositSnapshot} - ${payments.depositForfeitedAmount}`,
                  ),
                  depositForfeited: amount(
                    sql`${vn} and ${captured}`,
                    sql`${payments.depositForfeitedAmount}`,
                  ),
                  pendingRefundAmount: amount(
                    sql`${vn} and ${payments.status} = 'REFUND_PENDING'`,
                    refund,
                  ),
                  pendingRefundCount: quantity(
                    sql`${vn} and ${payments.status} = 'REFUND_PENDING'`,
                  ),
                  paymentsReceivedCount: quantity(sql`${vn} and ${inPeriod}`),
                  unclassifiedCollectedPayments: quantity(
                    sql`${vn} and ${inPeriod} and not ${knownSnapshot}`,
                  ),
                  unclassifiedDepositPayments: quantity(
                    sql`${vn} and ${captured} and not ${heldKnown} and ${notReturned}`,
                  ),
                  unsupportedCurrencyPayments: quantity(sql`not (${vn}) and ${captured}`),
                })
                .from(payments)
                .leftJoin(bookings, eq(bookings.id, payments.bookingId))
                .leftJoin(reservations, eq(reservations.id, payments.reservationId))
                .where(
                  and(
                    scopedPayment,
                    filter.unitTypeId ? eq(paymentUnitTypeId, filter.unitTypeId) : undefined,
                  ),
                )
                .groupBy(paymentFacilityId)
            : [];
        const returnPenalties =
          metrics !== "inventory"
            ? await tx
                .select({
                  facilityId: storageUnits.facilityId,
                  amount: sql<string>`coalesce(sum(${policyViolationFees.amount}), 0)::text`,
                })
                .from(policyViolationFees)
                .innerJoin(inspections, eq(inspections.id, policyViolationFees.referenceId))
                .innerJoin(rentals, eq(rentals.id, inspections.rentalId))
                .innerJoin(storageUnits, eq(storageUnits.id, rentals.storageUnitId))
                .where(
                  and(
                    eq(policyViolationFees.referenceType, "INSPECTION"),
                    eq(policyViolationFees.isActive, false),
                    gte(rentals.closedAt, start),
                    sql`${rentals.closedAt} < ${end.toISOString()}`,
                    filter.unitTypeId ? eq(storageUnits.unitTypeId, filter.unitTypeId) : undefined,
                    inArray(storageUnits.facilityId, scoped.ids),
                  ),
                )
                .groupBy(storageUnits.facilityId)
            : [];
        const inventory =
          metrics !== "financial"
            ? await tx
                .select({
                  facilityId: storageUnits.facilityId,
                  status: storageUnits.status,
                  count: count(),
                })
                .from(storageUnits)
                .where(
                  and(
                    inArray(storageUnits.facilityId, scoped.ids),
                    filter.unitTypeId ? eq(storageUnits.unitTypeId, filter.unitTypeId) : undefined,
                  ),
                )
                .groupBy(storageUnits.facilityId, storageUnits.status)
            : [];
        const holds =
          metrics !== "financial"
            ? await tx
                .select({ facilityId: capacityAllocations.facilityId, count: count() })
                .from(capacityAllocations)
                .where(
                  and(
                    inArray(capacityAllocations.facilityId, scoped.ids),
                    eq(capacityAllocations.kind, "HOLD"),
                    eq(capacityAllocations.status, "ACTIVE"),
                    gt(capacityAllocations.expiresAt, asOf),
                    filter.unitTypeId
                      ? eq(capacityAllocations.unitTypeId, filter.unitTypeId)
                      : undefined,
                  ),
                )
                .groupBy(capacityAllocations.facilityId)
            : [];
        const awaiting =
          metrics !== "financial"
            ? await tx
                .select({ facilityId: reservations.facilityId, count: count() })
                .from(reservations)
                .where(
                  and(
                    inArray(reservations.facilityId, scoped.ids),
                    eq(reservations.status, ReservationStatus.CONFIRMED),
                    filter.unitTypeId ? eq(reservations.unitTypeId, filter.unitTypeId) : undefined,
                  ),
                )
                .groupBy(reservations.facilityId)
            : [];
        return {
          facilities: scoped.facilities,
          financial,
          returnPenalties,
          inventory,
          holds,
          awaiting,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async monthlyRevenue(
    actor: ReportActor,
    filter: ReportFilters,
    start: Date,
    end: Date,
    asOf: Date,
  ) {
    return this.db.transaction(
      async (tx) => {
        const scoped = await this.scope(tx, actor, filter);
        const rules = financialRules(asOf);
        const predicate = and(
          or(
            inArray(paymentFacilityId, scoped.ids),
            scoped.includeUnattributed ? isNull(paymentFacilityId) : undefined,
          ),
          filter.unitTypeId ? eq(paymentUnitTypeId, filter.unitTypeId) : undefined,
        );
        // Group at the database: only monthly aggregates cross the boundary, not payment rows.
        const receiptMonth = sql<string>`to_char(${payments.paidAt} at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM')`;
        const refundMonth = sql<string>`to_char(${payments.refundedAt} at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM')`;
        const receipts = await tx
          .select({
            month: receiptMonth,
            cashReceived: amount(rules.vn, sql`${payments.totalAmount}`),
            rentalCollected: amount(
              sql`${rules.vn} and ${rules.knownSnapshot}`,
              sql`${rentalSnapshot}`,
            ),
            depositCollected: amount(
              sql`${rules.vn} and ${rules.knownSnapshot}`,
              sql`${depositSnapshot}`,
            ),
            unclassified: quantity(sql`${rules.vn} and not ${rules.knownSnapshot}`),
            unsupportedCurrencyPayments: quantity(sql`not (${rules.vn})`),
          })
          .from(payments)
          .leftJoin(bookings, eq(bookings.id, payments.bookingId))
          .leftJoin(reservations, eq(reservations.id, payments.reservationId))
          .where(
            and(
              predicate,
              rules.captured,
              sql`${payments.paidAt} >= ${start.toISOString()} and ${payments.paidAt} < ${end.toISOString()}`,
            ),
          )
          .groupBy(receiptMonth);
        const refunds = await tx
          .select({
            month: refundMonth,
            cashRefunded: amount(rules.vn, rules.refund),
          })
          .from(payments)
          .leftJoin(bookings, eq(bookings.id, payments.bookingId))
          .leftJoin(reservations, eq(reservations.id, payments.reservationId))
          .where(
            and(
              predicate,
              rules.settledRefund,
              sql`${payments.refundedAt} >= ${start.toISOString()} and ${payments.refundedAt} < ${end.toISOString()}`,
            ),
          )
          .groupBy(refundMonth);
        return { receipts, refunds };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async reconciliation(actor: ReportActor, query: RentalReportQuery, asOf: Date) {
    return this.db.transaction(
      async (tx) => {
        const scoped = await this.scope(tx, actor, query);
        const rules = financialRules(asOf);
        const predicate = and(
          or(
            inArray(paymentFacilityId, scoped.ids),
            scoped.includeUnattributed ? isNull(paymentFacilityId) : undefined,
          ),
          query.unitTypeId ? eq(paymentUnitTypeId, query.unitTypeId) : undefined,
          rules.captured,
          sql`(not ${rules.knownSnapshot} or not ${rules.heldKnown} or not (${rules.vn}))`,
        );
        const [total] = await tx
          .select({ count: count() })
          .from(payments)
          .leftJoin(bookings, eq(bookings.id, payments.bookingId))
          .leftJoin(reservations, eq(reservations.id, payments.reservationId))
          .where(predicate);
        const bookingItems = await tx
          .select({
            paymentId: payments.id,
            chargeId: sql<string | null>`null`,
            bookingId: payments.bookingId,
            facilityId: paymentFacilityId,
            currency: payments.currency,
            totalAmount: payments.totalAmount,
            status: payments.status,
            paidAt: payments.paidAt,
            missingSnapshot: sql<boolean>`not ${rules.knownSnapshot}`,
            unclassifiedDeposit: sql<boolean>`${rules.vn} and not ${rules.heldKnown}`,
            unsupportedCurrency: sql<boolean>`not (${rules.vn})`,
          })
          .from(payments)
          .leftJoin(bookings, eq(bookings.id, payments.bookingId))
          .leftJoin(reservations, eq(reservations.id, payments.reservationId))
          .where(predicate)
          .orderBy(asc(payments.paidAt), asc(payments.id))
          .limit(query.limit + query.offset);
        const items = bookingItems
          .sort(
            (a, b) =>
              (a.paidAt?.getTime() ?? 0) - (b.paidAt?.getTime() ?? 0) ||
              a.paymentId.localeCompare(b.paymentId),
          )
          .slice(query.offset, query.offset + query.limit);
        return { items, total: total?.count ?? 0 };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async rentalReport(actor: ReportActor, query: RentalReportQuery) {
    return this.db.transaction(
      async (tx) => {
        const scoped = await this.scope(tx, actor, query);
        const predicate = and(
          inArray(storageUnits.facilityId, scoped.ids),
          query.unitTypeId ? eq(storageUnits.unitTypeId, query.unitTypeId) : undefined,
          query.status ? eq(rentals.status, query.status as RentalStatus) : undefined,
        );
        const byStatus = await tx
          .select({ status: rentals.status, count: count() })
          .from(rentals)
          .innerJoin(storageUnits, eq(storageUnits.id, rentals.storageUnitId))
          .where(predicate)
          .groupBy(rentals.status)
          .orderBy(asc(rentals.status));
        const items = await tx
          .select({
            id: rentals.id,
            bookingCode: sql<
              string | null
            >`coalesce(${bookings.bookingCode}, upper(left(${reservations.id}::text, 8)))`,
            facilityId: storageUnits.facilityId,
            facilityName: facilities.name,
            unitCode: storageUnits.code,
            unitTypeName: unitTypes.name,
            status: rentals.status,
            startAt: rentals.startAt,
            expectedEndAt: rentals.endAt,
          })
          .from(rentals)
          .leftJoin(bookings, eq(bookings.id, rentals.bookingId))
          .leftJoin(reservations, eq(reservations.id, rentals.reservationId))
          .innerJoin(storageUnits, eq(storageUnits.id, rentals.storageUnitId))
          .innerJoin(facilities, eq(facilities.id, storageUnits.facilityId))
          .innerJoin(unitTypes, eq(unitTypes.id, storageUnits.unitTypeId))
          .where(predicate)
          .orderBy(asc(rentals.endAt), asc(rentals.id))
          .limit(query.limit)
          .offset(query.offset);
        return { items, byStatus, total: byStatus.reduce((total, row) => total + row.count, 0) };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
