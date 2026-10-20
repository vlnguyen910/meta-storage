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
  inArray,
  isNull,
  or,
  payments,
  rentals,
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

// Shared by aggregates and their drill-down so an alert identifies the same rows.
function financialRules(asOf: Date) {
  const vn = sql`${payments.currency} = 'VND'`;
  const captured = sql`${payments.paidAt} is not null and ${payments.paidAt} <= ${asOf.toISOString()}`;
  const known = sql`${bookings.rentalFeeAmount} >= 0 and ${bookings.depositAmount} >= 0 and ${payments.totalAmount} = ${bookings.rentalFeeAmount} + ${bookings.depositAmount} and ${payments.depositForfeitedAmount} <= ${bookings.depositAmount}`;
  const refund = sql`coalesce(${payments.refundAmount}, ${payments.totalAmount})`;
  const settledRefund = sql`${payments.status} = 'REFUNDED' and ${payments.refundedAt} is not null and ${payments.refundedAt} <= ${asOf.toISOString()}`;
  const knownRefund = sql`${settledRefund} and (${refund} = ${payments.totalAmount} or (${refund} = ${bookings.rentalFeeAmount} and ${payments.depositForfeitedAmount} = ${bookings.depositAmount}))`;
  const heldKnown = sql`coalesce((${known} and (${payments.status} = 'SUCCEEDED' or ((${payments.status} = 'REFUND_PENDING' or (${knownRefund})) and ${refund} + ${payments.depositForfeitedAmount} <= ${payments.totalAmount}))), false)`;
  const knownSnapshot = sql`coalesce((${known}), false)`;
  return { vn, captured, refund, settledRefund, heldKnown, knownSnapshot };
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
    includeFinancial = true,
  ) {
    return this.db.transaction(
      async (tx) => {
        const scoped = await this.scope(tx, actor, filter);
        const { vn, captured, refund, settledRefund, heldKnown, knownSnapshot } =
          financialRules(asOf);
        const inPeriod = sql`${captured} and ${payments.paidAt} >= ${start.toISOString()} and ${payments.paidAt} < ${end.toISOString()}`;
        const refundInPeriod = sql`${settledRefund} and ${payments.refundedAt} >= ${start.toISOString()} and ${payments.refundedAt} < ${end.toISOString()}`;
        const scopedPayment = or(
          inArray(bookings.facilityId, scoped.ids),
          scoped.includeUnattributed ? isNull(payments.bookingId) : undefined,
        );
        const financial = includeFinancial
          ? await tx
              .select({
                facilityId: bookings.facilityId,
                cashReceived: amount(sql`${vn} and ${inPeriod}`, sql`${payments.totalAmount}`),
                rentalCollected: amount(
                  sql`${vn} and ${inPeriod} and ${knownSnapshot}`,
                  sql`${bookings.rentalFeeAmount}`,
                ),
                depositCollected: amount(
                  sql`${vn} and ${inPeriod} and ${knownSnapshot}`,
                  sql`${bookings.depositAmount}`,
                ),
                cashRefunded: amount(sql`${vn} and ${refundInPeriod}`, refund),
                depositHeld: amount(
                  sql`${vn} and ${captured} and ${heldKnown} and ${payments.status} <> 'REFUNDED'`,
                  sql`${bookings.depositAmount} - ${payments.depositForfeitedAmount}`,
                ),
                depositForfeited: amount(
                  sql`${vn} and ${captured}`,
                  sql`${payments.depositForfeitedAmount}`,
                ),
                pendingRefundAmount: amount(
                  sql`${vn} and ${payments.status} = 'REFUND_PENDING'`,
                  refund,
                ),
                pendingRefundCount: quantity(sql`${vn} and ${payments.status} = 'REFUND_PENDING'`),
                paymentsReceivedCount: quantity(sql`${vn} and ${inPeriod}`),
                unclassifiedCollectedPayments: quantity(
                  sql`${vn} and ${inPeriod} and not ${knownSnapshot}`,
                ),
                unclassifiedDepositPayments: quantity(
                  sql`${vn} and ${captured} and not ${heldKnown}`,
                ),
                unsupportedCurrencyPayments: quantity(sql`not (${vn}) and ${captured}`),
              })
              .from(payments)
              .leftJoin(bookings, eq(bookings.id, payments.bookingId))
              .where(
                and(
                  scopedPayment,
                  filter.unitTypeId ? eq(bookings.unitTypeId, filter.unitTypeId) : undefined,
                ),
              )
              .groupBy(bookings.facilityId)
          : [];
        const inventory = await tx
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
          .groupBy(storageUnits.facilityId, storageUnits.status);
        const holds = await tx
          .select({ facilityId: capacityAllocations.facilityId, count: count() })
          .from(capacityAllocations)
          .where(
            and(
              inArray(capacityAllocations.facilityId, scoped.ids),
              eq(capacityAllocations.kind, "HOLD"),
              eq(capacityAllocations.status, "ACTIVE"),
              gt(capacityAllocations.expiresAt, asOf),
              filter.unitTypeId ? eq(capacityAllocations.unitTypeId, filter.unitTypeId) : undefined,
            ),
          )
          .groupBy(capacityAllocations.facilityId);
        const awaiting = await tx
          .select({ facilityId: bookings.facilityId, count: count() })
          .from(bookings)
          .where(
            and(
              inArray(bookings.facilityId, scoped.ids),
              eq(bookings.status, "CONFIRMED"),
              filter.unitTypeId ? eq(bookings.unitTypeId, filter.unitTypeId) : undefined,
            ),
          )
          .groupBy(bookings.facilityId);
        return { facilities: scoped.facilities, financial, inventory, holds, awaiting };
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
            inArray(bookings.facilityId, scoped.ids),
            scoped.includeUnattributed ? isNull(payments.bookingId) : undefined,
          ),
          filter.unitTypeId ? eq(bookings.unitTypeId, filter.unitTypeId) : undefined,
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
              sql`${bookings.rentalFeeAmount}`,
            ),
            depositCollected: amount(
              sql`${rules.vn} and ${rules.knownSnapshot}`,
              sql`${bookings.depositAmount}`,
            ),
            unclassified: quantity(sql`${rules.vn} and not ${rules.knownSnapshot}`),
            unsupportedCurrencyPayments: quantity(sql`not (${rules.vn})`),
          })
          .from(payments)
          .leftJoin(bookings, eq(bookings.id, payments.bookingId))
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
            inArray(bookings.facilityId, scoped.ids),
            scoped.includeUnattributed ? isNull(payments.bookingId) : undefined,
          ),
          query.unitTypeId ? eq(bookings.unitTypeId, query.unitTypeId) : undefined,
          rules.captured,
          sql`(not ${rules.knownSnapshot} or not ${rules.heldKnown} or not (${rules.vn}))`,
        );
        const [total] = await tx
          .select({ count: count() })
          .from(payments)
          .leftJoin(bookings, eq(bookings.id, payments.bookingId))
          .where(predicate);
        const items = await tx
          .select({
            paymentId: payments.id,
            bookingId: payments.bookingId,
            facilityId: bookings.facilityId,
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
          .where(predicate)
          .orderBy(asc(payments.paidAt), asc(payments.id))
          .limit(query.limit)
          .offset(query.offset);
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
          inArray(rentals.facilityId, scoped.ids),
          query.unitTypeId ? eq(bookings.unitTypeId, query.unitTypeId) : undefined,
          query.status ? eq(rentals.status, query.status) : undefined,
        );
        const byStatus = await tx
          .select({ status: rentals.status, count: count() })
          .from(rentals)
          .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
          .where(predicate)
          .groupBy(rentals.status)
          .orderBy(asc(rentals.status));
        const items = await tx
          .select({
            id: rentals.id,
            bookingCode: bookings.bookingCode,
            facilityId: rentals.facilityId,
            facilityName: facilities.name,
            unitCode: storageUnits.code,
            unitTypeName: unitTypes.name,
            status: rentals.status,
            startAt: rentals.startAt,
            expectedEndAt: rentals.expectedEndAt,
          })
          .from(rentals)
          .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
          .innerJoin(facilities, eq(facilities.id, rentals.facilityId))
          .innerJoin(storageUnits, eq(storageUnits.id, rentals.physicalUnitId))
          .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
          .where(predicate)
          .orderBy(asc(rentals.expectedEndAt), asc(rentals.id))
          .limit(query.limit)
          .offset(query.offset);
        return { items, byStatus, total: byStatus.reduce((total, row) => total + row.count, 0) };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
