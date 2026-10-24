import { REPORT_MESSAGES as m, type RentalReportQuery } from "@metastorage/contracts";
import {
  and,
  asc,
  bookings,
  capacityAllocations,
  count,
  type Database,
  desc,
  eq,
  facilities,
  gt,
  inArray,
  isNull,
  lte,
  or,
  payments,
  rentalChargeRefunds,
  rentalCharges,
  rentals,
  returnRefunds,
  returnRequests,
  returnSettlements,
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

// One row per booking: aggregate transfers before joining the latest effective revision.
// This prevents a revision × refund fan-out from multiplying receipts/refunds.
function returnAccounting(tx: ReportTransaction, asOf: Date, start: Date, end: Date) {
  const deposit = sql`greatest(${returnSettlements.depositSnapshot} - ${returnSettlements.overdueFeeAmount} - ${returnSettlements.damageAmount}, 0)`;
  const allocatedDeposit = sql`coalesce(${returnRefunds.depositRefundAmount}, case
    when ${returnSettlements.unusedRentRefundAmount} = 0 then ${returnRefunds.amount}
    when ${deposit} = 0 then 0
    when ${returnRefunds.amount} = ${returnSettlements.refundEntitlement} then ${deposit}
    else null end)`;
  const transfers = tx
    .select({
      requestId: returnRefunds.requestId,
      total: sql<string>`sum(${returnRefunds.amount})`.as("refund_total"),
      inPeriod:
        sql<string>`sum(case when ${returnRefunds.confirmedAt} >= ${start.toISOString()} and ${returnRefunds.confirmedAt} < ${end.toISOString()} then ${returnRefunds.amount} else 0 end)`.as(
          "period_refund",
        ),
      depositPaid: sql<string>`coalesce(sum(${allocatedDeposit}), 0)`.as("deposit_paid"),
      unknown: sql<boolean>`bool_or(${allocatedDeposit} is null)`.as("refund_unknown"),
    })
    .from(returnRefunds)
    .innerJoin(returnSettlements, eq(returnSettlements.id, returnRefunds.settlementId))
    .where(lte(returnRefunds.confirmedAt, asOf))
    .groupBy(returnRefunds.requestId)
    .as("return_transfers");
  const latest = tx
    .selectDistinctOn([rentals.bookingId], {
      bookingId: rentals.bookingId,
      requestId: returnSettlements.requestId,
      entitlement: returnSettlements.refundEntitlement,
      deposit: sql<string>`${deposit}`.as("deposit_available"),
    })
    .from(returnSettlements)
    .innerJoin(returnRequests, eq(returnRequests.id, returnSettlements.requestId))
    .innerJoin(rentals, eq(rentals.id, returnRequests.rentalId))
    .where(lte(returnSettlements.approvedAt, asOf))
    .orderBy(rentals.bookingId, desc(returnSettlements.revision))
    .as("latest_return_settlement");
  return tx
    .select({
      bookingId: latest.bookingId,
      requestId: latest.requestId,
      inPeriod: sql<string>`coalesce(${transfers.inPeriod}, 0)`.as("return_cash_refunded"),
      pending: sql<string>`greatest(${latest.entitlement} - coalesce(${transfers.total}, 0), 0)`.as(
        "return_pending",
      ),
      held: sql<string>`greatest(${latest.deposit} - coalesce(${transfers.depositPaid}, 0), 0)`.as(
        "return_deposit_held",
      ),
      unknown: sql<boolean>`coalesce(${transfers.unknown}, false)`.as("return_unclassified"),
    })
    .from(latest)
    .leftJoin(transfers, eq(transfers.requestId, latest.requestId))
    .as("return_accounting");
}

// Shared by aggregates and their drill-down so an alert identifies the same rows.
function financialRules(asOf: Date, accounting: ReturnType<typeof returnAccounting>) {
  const vn = sql`${payments.currency} = 'VND'`;
  const captured = sql`${payments.paidAt} is not null and ${payments.paidAt} <= ${asOf.toISOString()}`;
  const known = sql`${bookings.rentalFeeAmount} >= 0 and ${bookings.depositAmount} >= 0 and ${payments.totalAmount} = ${bookings.rentalFeeAmount} + ${bookings.depositAmount} and ${payments.depositForfeitedAmount} <= ${bookings.depositAmount}`;
  const refund = sql`coalesce(${payments.refundAmount}, ${payments.totalAmount})`;
  const settledRefund = sql`${payments.status} = 'REFUNDED' and ${payments.refundedAt} is not null and ${payments.refundedAt} <= ${asOf.toISOString()}`;
  const knownRefund = sql`${settledRefund} and (${refund} = ${payments.totalAmount} or (${refund} = ${bookings.rentalFeeAmount} and ${payments.depositForfeitedAmount} = ${bookings.depositAmount}))`;
  const legacyHeldKnown = sql`coalesce((${known} and (${payments.status} = 'SUCCEEDED' or ((${payments.status} = 'REFUND_PENDING' or (${knownRefund})) and ${refund} + ${payments.depositForfeitedAmount} <= ${payments.totalAmount}))), false)`;
  const returnKnown = sql`${accounting.requestId} is not null and ${payments.status} = 'SUCCEEDED'`;
  const heldKnown = sql`(${legacyHeldKnown} and (not (${returnKnown}) or not ${accounting.unknown}))`;
  const knownSnapshot = sql`coalesce((${known}), false)`;
  return { vn, captured, refund, settledRefund, heldKnown, knownSnapshot, returnKnown };
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
        const accounting = returnAccounting(tx, asOf, start, end);
        const { vn, captured, refund, settledRefund, heldKnown, knownSnapshot, returnKnown } =
          financialRules(asOf, accounting);
        const inPeriod = sql`${captured} and ${payments.paidAt} >= ${start.toISOString()} and ${payments.paidAt} < ${end.toISOString()}`;
        const refundInPeriod = sql`${settledRefund} and ${payments.refundedAt} >= ${start.toISOString()} and ${payments.refundedAt} < ${end.toISOString()}`;
        const scopedPayment = and(
          isNull(payments.rentalChargeId),
          or(
            inArray(bookings.facilityId, scoped.ids),
            scoped.includeUnattributed ? isNull(payments.bookingId) : undefined,
          ),
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
                cashRefunded:
                  sql<string>`${amount(sql`${vn} and ${refundInPeriod}`, refund)}::numeric + ${amount(sql`${vn} and ${captured} and ${returnKnown}`, sql`${accounting.inPeriod}`)}::numeric`.as(
                    "cash_refunded",
                  ),
                depositHeld: amount(
                  sql`${vn} and ${captured} and ${heldKnown} and ${payments.status} <> 'REFUNDED'`,
                  sql`case when ${returnKnown} then ${accounting.held} else ${bookings.depositAmount} - ${payments.depositForfeitedAmount} end`,
                ),
                depositForfeited: amount(
                  sql`${vn} and ${captured}`,
                  sql`${payments.depositForfeitedAmount}`,
                ),
                pendingRefundAmount: amount(
                  sql`${vn} and (${payments.status} = 'REFUND_PENDING' or (${captured} and ${returnKnown}))`,
                  sql`case when ${returnKnown} then ${accounting.pending} else ${refund} end`,
                ),
                pendingRefundCount: quantity(
                  sql`${vn} and (${payments.status} = 'REFUND_PENDING' or (${captured} and ${returnKnown} and ${accounting.pending} > 0))`,
                ),
                pendingReturnRefundAmount: amount(
                  sql`${vn} and ${captured} and ${returnKnown}`,
                  sql`${accounting.pending}`,
                ),
                pendingReturnRefundCount: quantity(
                  sql`${vn} and ${captured} and ${returnKnown} and ${accounting.pending} > 0`,
                ),
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
              .leftJoin(accounting, eq(accounting.bookingId, payments.bookingId))
              .where(
                and(
                  scopedPayment,
                  filter.unitTypeId ? eq(bookings.unitTypeId, filter.unitTypeId) : undefined,
                ),
              )
              .groupBy(bookings.facilityId)
          : [];
        const chargePayments = includeFinancial
          ? await tx
              .select({
                facilityId: rentals.facilityId,
                renewalCollected: amount(
                  sql`${payments.currency} = 'VND' and ${rentalCharges.source} = 'RENEWAL' and ${payments.paidAt} >= ${start.toISOString()} and ${payments.paidAt} < ${end.toISOString()}`,
                  sql`${payments.totalAmount}`,
                ),
                extraChargeCollected: amount(
                  sql`${payments.currency} = 'VND' and ${rentalCharges.source} = 'EXTRA' and ${payments.paidAt} >= ${start.toISOString()} and ${payments.paidAt} < ${end.toISOString()}`,
                  sql`${payments.totalAmount}`,
                ),
                returnDebtCollected: amount(
                  sql`${payments.currency} = 'VND' and ${rentalCharges.source} = 'RETURN_DEBT' and ${payments.paidAt} >= ${start.toISOString()} and ${payments.paidAt} < ${end.toISOString()}`,
                  sql`${payments.totalAmount}`,
                ),
                cashReceived: amount(
                  sql`${payments.currency} = 'VND' and ${payments.paidAt} >= ${start.toISOString()} and ${payments.paidAt} < ${end.toISOString()}`,
                  sql`${payments.totalAmount}`,
                ),
                paymentsReceivedCount: quantity(
                  sql`${payments.currency} = 'VND' and ${payments.paidAt} >= ${start.toISOString()} and ${payments.paidAt} < ${end.toISOString()}`,
                ),
                unsupportedCurrencyPayments: quantity(sql`${payments.currency} <> 'VND'`),
              })
              .from(payments)
              .innerJoin(rentalCharges, eq(rentalCharges.id, payments.rentalChargeId))
              .innerJoin(rentals, eq(rentals.id, rentalCharges.rentalId))
              .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
              .where(
                and(
                  inArray(rentals.facilityId, scoped.ids),
                  sql`${payments.status} in ('SUCCEEDED','REFUND_PENDING','REFUNDED') and ${payments.paidAt} is not null and ${payments.paidAt} <= ${asOf.toISOString()}`,
                  filter.unitTypeId ? eq(bookings.unitTypeId, filter.unitTypeId) : undefined,
                ),
              )
              .groupBy(rentals.facilityId)
          : [];
        const chargeRefunds = includeFinancial
          ? await tx
              .select({
                facilityId: rentals.facilityId,
                chargeRefunded: amount(
                  sql`${rentalChargeRefunds.status} = 'CONFIRMED' and ${rentalChargeRefunds.confirmedAt} >= ${start.toISOString()} and ${rentalChargeRefunds.confirmedAt} < ${end.toISOString()} and ${rentalChargeRefunds.confirmedAt} <= ${asOf.toISOString()}`,
                  sql`${rentalChargeRefunds.amount}`,
                ),
                pendingChargeRefundAmount: amount(
                  eq(rentalChargeRefunds.status, "PENDING"),
                  sql`${rentalChargeRefunds.amount}`,
                ),
                pendingChargeRefundCount: quantity(eq(rentalChargeRefunds.status, "PENDING")),
              })
              .from(rentalChargeRefunds)
              .innerJoin(rentalCharges, eq(rentalCharges.id, rentalChargeRefunds.chargeId))
              .innerJoin(rentals, eq(rentals.id, rentalCharges.rentalId))
              .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
              .where(
                and(
                  inArray(rentals.facilityId, scoped.ids),
                  filter.unitTypeId ? eq(bookings.unitTypeId, filter.unitTypeId) : undefined,
                  or(
                    and(
                      eq(rentalChargeRefunds.status, "PENDING"),
                      lte(rentalChargeRefunds.createdAt, asOf),
                    ),
                    and(
                      eq(rentalChargeRefunds.status, "CONFIRMED"),
                      lte(rentalChargeRefunds.confirmedAt, asOf),
                    ),
                  ),
                ),
              )
              .groupBy(rentals.facilityId)
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
        return {
          facilities: scoped.facilities,
          financial,
          chargePayments,
          chargeRefunds,
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
        const accounting = returnAccounting(tx, asOf, start, end);
        const rules = financialRules(asOf, accounting);
        const predicate = and(
          isNull(payments.rentalChargeId),
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
        const chargeReceiptMonth = sql<string>`to_char(${payments.paidAt} at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM')`;
        const chargeReceipts = await tx
          .select({
            month: chargeReceiptMonth,
            cashReceived: amount(eq(payments.currency, "VND"), sql`${payments.totalAmount}`),
            renewalCollected: amount(
              sql`${payments.currency} = 'VND' and ${rentalCharges.source} = 'RENEWAL'`,
              sql`${payments.totalAmount}`,
            ),
            extraChargeCollected: amount(
              sql`${payments.currency} = 'VND' and ${rentalCharges.source} = 'EXTRA'`,
              sql`${payments.totalAmount}`,
            ),
            returnDebtCollected: amount(
              sql`${payments.currency} = 'VND' and ${rentalCharges.source} = 'RETURN_DEBT'`,
              sql`${payments.totalAmount}`,
            ),
            unsupportedCurrencyPayments: quantity(sql`${payments.currency} <> 'VND'`),
          })
          .from(payments)
          .innerJoin(rentalCharges, eq(rentalCharges.id, payments.rentalChargeId))
          .innerJoin(rentals, eq(rentals.id, rentalCharges.rentalId))
          .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
          .where(
            and(
              inArray(rentals.facilityId, scoped.ids),
              filter.unitTypeId ? eq(bookings.unitTypeId, filter.unitTypeId) : undefined,
              inArray(payments.status, ["SUCCEEDED", "REFUND_PENDING", "REFUNDED"]),
              lte(payments.paidAt, asOf),
              sql`${payments.paidAt} >= ${start.toISOString()} and ${payments.paidAt} < ${end.toISOString()}`,
            ),
          )
          .groupBy(chargeReceiptMonth);
        const chargeRefundMonth = sql<string>`to_char(${rentalChargeRefunds.confirmedAt} at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM')`;
        const chargeRefundMonths = await tx
          .select({
            month: chargeRefundMonth,
            chargeRefunded: amount(sql`true`, sql`${rentalChargeRefunds.amount}`),
          })
          .from(rentalChargeRefunds)
          .innerJoin(rentalCharges, eq(rentalCharges.id, rentalChargeRefunds.chargeId))
          .innerJoin(rentals, eq(rentals.id, rentalCharges.rentalId))
          .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
          .where(
            and(
              inArray(rentals.facilityId, scoped.ids),
              filter.unitTypeId ? eq(bookings.unitTypeId, filter.unitTypeId) : undefined,
              eq(rentalChargeRefunds.status, "CONFIRMED"),
              lte(rentalChargeRefunds.confirmedAt, asOf),
              sql`${rentalChargeRefunds.confirmedAt} >= ${start.toISOString()} and ${rentalChargeRefunds.confirmedAt} < ${end.toISOString()}`,
            ),
          )
          .groupBy(chargeRefundMonth);
        return { receipts, refunds, chargeReceipts, chargeRefunds: chargeRefundMonths };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async reconciliation(actor: ReportActor, query: RentalReportQuery, asOf: Date) {
    return this.db.transaction(
      async (tx) => {
        const scoped = await this.scope(tx, actor, query);
        const accounting = returnAccounting(tx, asOf, new Date(0), asOf);
        const rules = financialRules(asOf, accounting);
        const predicate = and(
          isNull(payments.rentalChargeId),
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
          .leftJoin(accounting, eq(accounting.bookingId, payments.bookingId))
          .where(predicate);
        const bookingItems = await tx
          .select({
            paymentId: payments.id,
            chargeId: sql<string | null>`null`,
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
          .leftJoin(accounting, eq(accounting.bookingId, payments.bookingId))
          .where(predicate)
          .orderBy(asc(payments.paidAt), asc(payments.id))
          .limit(query.limit + query.offset);
        const chargePredicate = and(
          inArray(rentals.facilityId, scoped.ids),
          query.unitTypeId ? eq(bookings.unitTypeId, query.unitTypeId) : undefined,
          sql`${payments.paidAt} is not null and ${payments.paidAt} <= ${asOf.toISOString()} and ${payments.status} in ('SUCCEEDED','REFUND_PENDING','REFUNDED')`,
          sql`(${payments.currency} <> 'VND' or (${payments.status} = 'REFUND_PENDING' and ${rentalCharges.status} = 'REFUND_DUE') or (${payments.status} = 'SUCCEEDED' and ${rentalCharges.status} <> 'PAID'))`,
        );
        const [chargeTotal] = await tx
          .select({ count: count() })
          .from(payments)
          .innerJoin(rentalCharges, eq(rentalCharges.id, payments.rentalChargeId))
          .innerJoin(rentals, eq(rentals.id, rentalCharges.rentalId))
          .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
          .where(chargePredicate);
        const chargeItems = await tx
          .select({
            paymentId: payments.id,
            chargeId: rentalCharges.id,
            bookingId: sql<string | null>`null`,
            facilityId: rentals.facilityId,
            currency: payments.currency,
            totalAmount: payments.totalAmount,
            status: payments.status,
            paidAt: payments.paidAt,
            missingSnapshot: sql<boolean>`false`,
            unclassifiedDeposit: sql<boolean>`false`,
            unsupportedCurrency: sql<boolean>`${payments.currency} <> 'VND'`,
          })
          .from(payments)
          .innerJoin(rentalCharges, eq(rentalCharges.id, payments.rentalChargeId))
          .innerJoin(rentals, eq(rentals.id, rentalCharges.rentalId))
          .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
          .where(chargePredicate)
          .orderBy(asc(payments.paidAt), asc(payments.id))
          .limit(query.limit + query.offset);
        const items = [...bookingItems, ...chargeItems]
          .sort(
            (a, b) =>
              (a.paidAt?.getTime() ?? 0) - (b.paidAt?.getTime() ?? 0) ||
              a.paymentId.localeCompare(b.paymentId),
          )
          .slice(query.offset, query.offset + query.limit);
        return { items, total: (total?.count ?? 0) + (chargeTotal?.count ?? 0) };
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
