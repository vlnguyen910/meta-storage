import {
  RENEWAL_MESSAGES as m,
  type QuoteRenewal,
  type RenewalPageQuery,
} from "@metastorage/contracts/renewals";
import {
  and,
  bookings,
  capacityAllocations,
  type Database,
  desc,
  eq,
  facilities,
  gte,
  inArray,
  isNotNull,
  lte,
  notificationOutbox,
  payments,
  rentalChargeAdjustments,
  rentalChargeEvents,
  rentalChargeRefunds,
  rentalCharges,
  rentalPriceRanges,
  rentalRenewals,
  rentals,
  returnRequests,
  sql,
  storageUnits,
  unitTypes,
} from "@metastorage/database";
import { AppError, ConflictError, NotFoundError } from "../../common/errors/app-error";
import { lifecycleExpiryDetail } from "../notifications/lifecycle-notifications.messages";
import { recordLifecycleEvent } from "../notifications/lifecycle-notifications.repository";
import { facilityLifecycleClock } from "../rentals/rental-lifecycle.repository";
import { recordImmediateExpiry } from "../rentals/rental-lifecycle.service";
import { ReturnsRepository } from "../returns/returns.repository";
import type { ReturnContext } from "../returns/returns.types";
import { StorageUnitsRepository } from "../storage-units/storage-units.repository";
import { RENEWAL_MONTH_MS, renewalTermFailure } from "./renewals.policy";
import type { PayableRenewal, RenewalFailure, RenewalTransaction } from "./renewals.types";

export class RenewalsRepository {
  constructor(private readonly db: Database) {}

  async quote(rentalId: string, customerId: string, input: QuoteRenewal) {
    return new ReturnsRepository(this.db).locked(rentalId, async (tx, context) => {
      if (context.booking.userId !== customerId) throw new NotFoundError(m.notFound);
      const [existing] = await tx
        .select()
        .from(rentalRenewals)
        .where(
          and(
            eq(rentalRenewals.rentalId, rentalId),
            eq(rentalRenewals.idempotencyKey, input.idempotencyKey),
          ),
        );
      if (existing) {
        if (existing.months !== input.months) throw new ConflictError(m.idempotency);
        return existing;
      }
      const now = new Date();
      if (
        context.rental.status !== "ACTIVE" ||
        context.rental.closedAt ||
        context.rental.actualReturnAt
      )
        throw new ConflictError(m.ineligible);
      const clock = await facilityLifecycleClock(tx, context.rental.facilityId);
      if (!clock) throw new AppError(m.configuration, 503);
      // Facility-local date subtraction/end-of-day needs PostgreSQL timezone arithmetic.
      const [deadline] = await tx
        .select({
          cutoffAt:
            sql<Date>`(((${rentals.expectedEndAt} at time zone ${clock.timezone})::date - 5)::timestamp at time zone ${clock.timezone}) - interval '1 millisecond'`.mapWith(
              (value) => new Date(value),
            ),
        })
        .from(rentals)
        .where(eq(rentals.id, rentalId));
      if (!deadline) throw new NotFoundError(m.notFound);
      if (now >= deadline.cutoffAt) throw new ConflictError(m.cutoff);
      const newEndAt = new Date(
        context.rental.expectedEndAt.getTime() + input.months * RENEWAL_MONTH_MS,
      );
      const failure = await this.eligibility(tx, context, newEndAt);
      if (failure) throw new ConflictError(m[failure]);
      const [rate] = await tx
        .select({ amount: unitTypes.monthlyPrice })
        .from(unitTypes)
        .innerJoin(rentalPriceRanges, eq(rentalPriceRanges.id, unitTypes.priceRangeId))
        .where(
          and(
            eq(unitTypes.id, context.booking.unitTypeId),
            eq(unitTypes.facilityId, context.rental.facilityId),
            eq(rentalPriceRanges.isActive, true),
            isNotNull(rentalPriceRanges.minMonthlyPrice),
            isNotNull(rentalPriceRanges.maxMonthlyPrice),
            gte(unitTypes.monthlyPrice, rentalPriceRanges.minMonthlyPrice),
            lte(unitTypes.monthlyPrice, rentalPriceRanges.maxMonthlyPrice),
          ),
        );
      if (!rate || rate.amount <= 0) throw new AppError(m.configuration, 503);
      const [quote] = await tx
        .insert(rentalRenewals)
        .values({
          rentalId,
          customerId,
          rentalVersion: context.rental.version,
          months: input.months,
          idempotencyKey: input.idempotencyKey,
          oldEndAt: context.rental.expectedEndAt,
          newEndAt,
          monthlyRate: String(rate.amount),
          amount: String(rate.amount * input.months),
          timezone: clock.timezone,
          cutoffAt: deadline.cutoffAt,
          expiresAt: new Date(Math.min(now.getTime() + 15 * 60_000, deadline.cutoffAt.getTime())),
          termsVersion: m.termsVersion,
          terms: m.terms,
          createdAt: now,
        })
        .returning();
      if (!quote) throw new AppError(m.persistence, 500);
      return quote;
    });
  }

  async accept(renewalId: string, customerId: string, termsVersion: string) {
    const initial = await this.find(renewalId, customerId);
    return new ReturnsRepository(this.db).locked(initial.rentalId, async (tx, context) => {
      if (context.booking.userId !== customerId) throw new NotFoundError(m.notFound);
      const [quote] = await tx
        .select()
        .from(rentalRenewals)
        .where(eq(rentalRenewals.id, renewalId))
        .for("update");
      if (!quote) throw new NotFoundError(m.notFound);
      if (quote.termsVersion !== termsVersion) throw new ConflictError(m.stale);
      if (quote.acceptedAt) return quote;
      const now = new Date();
      const failure =
        renewalTermFailure(context.rental, quote, now) ??
        (await this.eligibility(tx, context, quote.newEndAt));
      if (failure) throw new ConflictError(m[failure]);
      const [charge] = await tx
        .insert(rentalCharges)
        .values({
          rentalId: quote.rentalId,
          source: "RENEWAL",
          category: "RENEWAL_RENT",
          amount: quote.amount,
          currency: "VND",
          evidence: quote.terms,
          createdBy: customerId,
          status: "OPEN",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!charge) throw new AppError(m.persistence, 500);
      await tx.insert(rentalChargeEvents).values({
        chargeId: charge.id,
        type: "SUBMITTED",
        actorId: customerId,
        details: { renewalId, termsVersion, acceptedAt: now.toISOString() },
      });
      const [updated] = await tx
        .update(rentalRenewals)
        .set({ chargeId: charge.id, acceptedAt: now, status: "AWAITING_PAYMENT" })
        .where(eq(rentalRenewals.id, renewalId))
        .returning();
      if (!updated) throw new AppError(m.persistence, 500);
      return updated;
    });
  }

  async find(id: string, customerId: string) {
    const [quote] = await this.db
      .select({ quote: rentalRenewals })
      .from(rentalRenewals)
      .innerJoin(rentals, eq(rentals.id, rentalRenewals.rentalId))
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .where(and(eq(rentalRenewals.id, id), eq(bookings.userId, customerId)));
    if (!quote) throw new NotFoundError(m.notFound);
    return quote.quote;
  }

  async list(rentalId: string, customerId: string, query: RenewalPageQuery) {
    const [rental] = await this.db
      .select({ id: rentals.id })
      .from(rentals)
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .where(and(eq(rentals.id, rentalId), eq(bookings.userId, customerId)));
    if (!rental) throw new NotFoundError(m.notFound);
    return this.db
      .select()
      .from(rentalRenewals)
      .where(eq(rentalRenewals.rentalId, rentalId))
      .orderBy(desc(rentalRenewals.createdAt), desc(rentalRenewals.id))
      .limit(query.limit)
      .offset(query.offset);
  }

  // Caller holds facility → booking → rental before taking charge/payment locks.
  async payable(tx: RenewalTransaction, chargeId: string, at: Date): Promise<PayableRenewal> {
    const [row] = await tx
      .select({ quote: rentalRenewals, rental: rentals, booking: bookings })
      .from(rentalRenewals)
      .innerJoin(rentals, eq(rentals.id, rentalRenewals.rentalId))
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .where(eq(rentalRenewals.chargeId, chargeId))
      .for("update", { of: rentalRenewals });
    if (!row?.quote.acceptedAt || row.quote.status !== "AWAITING_PAYMENT")
      return { failure: "stale" as const };
    const failure =
      renewalTermFailure(row.rental, row.quote, at) ??
      (await this.eligibility(tx, row, row.quote.newEndAt));
    return failure ? { failure } : { quote: row.quote, rental: row.rental, booking: row.booking };
  }

  async apply(tx: RenewalTransaction, chargeId: string, paymentId: string, paidAt: Date) {
    const result = await this.payable(tx, chargeId, paidAt);
    if ("failure" in result) {
      await this.rejectCapture(tx, chargeId, paymentId, result.failure);
      return false;
    }
    const { quote, rental, booking } = result;
    const [updated] = await tx
      .update(rentals)
      .set({
        expectedEndAt: quote.newEndAt,
        version: rental.version + 1,
        abandonedReviewAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(rentals.id, rental.id), eq(rentals.version, quote.rentalVersion)))
      .returning();
    if (!updated) throw new ConflictError(m.stale);
    await tx
      .update(capacityAllocations)
      .set({ endsAt: quote.newEndAt, updatedAt: new Date() })
      .where(
        and(
          eq(capacityAllocations.referenceId, booking.id),
          eq(capacityAllocations.kind, "BOOKING"),
          eq(capacityAllocations.status, "ACTIVE"),
        ),
      );
    await tx
      .update(rentalRenewals)
      .set({ status: "APPLIED", paymentId, appliedAt: new Date() })
      .where(eq(rentalRenewals.id, quote.id));
    await tx
      .update(notificationOutbox)
      .set({ status: "SUPPRESSED", leaseToken: null, leaseUntil: null })
      .where(
        and(
          eq(notificationOutbox.bookingId, booking.id),
          inArray(notificationOutbox.eventType, [
            "UPCOMING_EXPIRY",
            "RENTAL_OVERDUE",
            "ABANDONED_REVIEW",
          ]),
          inArray(notificationOutbox.status, ["PENDING", "PROCESSING", "ENQUEUED"]),
        ),
      );
    await recordLifecycleEvent(tx, {
      key: `renewal:${quote.id}:applied`,
      type: "PAYMENT_CONFIRMED",
      bookingId: booking.id,
      detail: lifecycleExpiryDetail(quote.newEndAt.toISOString()),
      occurredAt: new Date(),
    });
    await recordImmediateExpiry(tx, updated, new Date());
    return true;
  }

  rejectCapture(
    tx: RenewalTransaction,
    chargeId: string,
    paymentId: string,
    failureReason: RenewalFailure,
  ) {
    return tx
      .update(rentalRenewals)
      .set({ status: "REFUND_REQUIRED", paymentId, failureReason })
      .where(
        and(eq(rentalRenewals.chargeId, chargeId), eq(rentalRenewals.status, "AWAITING_PAYMENT")),
      );
  }

  private async eligibility(
    tx: RenewalTransaction,
    context: ReturnContext,
    newEndAt: Date,
  ): Promise<RenewalFailure | null> {
    if (!context.booking.userId || context.rental.expectedEndAt <= new Date()) return "ineligible";
    const [request] = await tx
      .select({ id: returnRequests.id })
      .from(returnRequests)
      .where(eq(returnRequests.rentalId, context.rental.id))
      .limit(1);
    if (request) return "returnStarted";
    const debtAdjustments = tx
      .select({
        chargeId: rentalChargeAdjustments.chargeId,
        amount:
          sql<string>`sum(case when ${rentalChargeAdjustments.direction} = 'INCREASE' then ${rentalChargeAdjustments.amount} else -${rentalChargeAdjustments.amount} end)`.as(
            "debt_adjustment_amount",
          ),
      })
      .from(rentalChargeAdjustments)
      .groupBy(rentalChargeAdjustments.chargeId)
      .as("debt_adjustments");
    const debtPayments = tx
      .select({
        chargeId: payments.rentalChargeId,
        amount: sql<string>`sum(${payments.totalAmount})`.as("debt_paid_amount"),
      })
      .from(payments)
      .where(eq(payments.status, "SUCCEEDED"))
      .groupBy(payments.rentalChargeId)
      .as("debt_payments");
    const debtRefunds = tx
      .select({
        chargeId: rentalChargeRefunds.chargeId,
        amount: sql<string>`sum(${rentalChargeRefunds.amount})`.as("debt_refund_amount"),
      })
      .from(rentalChargeRefunds)
      .where(eq(rentalChargeRefunds.status, "CONFIRMED"))
      .groupBy(rentalChargeRefunds.chargeId)
      .as("debt_refunds");
    const [debt] = await tx
      .select({ id: rentalCharges.id })
      .from(rentalCharges)
      .innerJoin(rentals, eq(rentals.id, rentalCharges.rentalId))
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .leftJoin(debtAdjustments, eq(debtAdjustments.chargeId, rentalCharges.id))
      .leftJoin(debtPayments, eq(debtPayments.chargeId, rentalCharges.id))
      .leftJoin(debtRefunds, eq(debtRefunds.chargeId, rentalCharges.id))
      .where(
        and(
          eq(bookings.userId, context.booking.userId),
          eq(rentalCharges.source, "RETURN_DEBT"),
          sql`${rentalCharges.status} <> 'VOID' and ${rentalCharges.amount} + coalesce(${debtAdjustments.amount}, 0) > coalesce(${debtPayments.amount}, 0) - coalesce(${debtRefunds.amount}, 0)`,
        ),
      )
      .limit(1);
    if (debt) return "debt";
    const [offering] = await tx
      .select({
        active: unitTypes.isActive,
        facilityActive: facilities.isActive,
        typeActive: unitTypes.isActive,
      })
      .from(unitTypes)
      .innerJoin(facilities, eq(facilities.id, unitTypes.facilityId))
      .where(
        and(
          eq(unitTypes.facilityId, context.rental.facilityId),
          eq(unitTypes.id, context.booking.unitTypeId),
        ),
      )
      .for("update", { of: unitTypes });
    if (!offering?.active || !offering.facilityActive || !offering.typeActive)
      return "configuration";
    const [unit] = await tx
      .select({ id: storageUnits.id })
      .from(storageUnits)
      .where(
        and(
          eq(storageUnits.id, context.rental.physicalUnitId),
          eq(storageUnits.facilityId, context.rental.facilityId),
          eq(storageUnits.unitTypeId, context.booking.unitTypeId),
          eq(storageUnits.status, "OCCUPIED"),
        ),
      );
    const allocations = await tx
      .select({ id: capacityAllocations.id })
      .from(capacityAllocations)
      .where(
        and(
          eq(capacityAllocations.referenceId, context.booking.id),
          eq(capacityAllocations.kind, "BOOKING"),
          eq(capacityAllocations.status, "ACTIVE"),
        ),
      )
      .for("update");
    if (!unit || allocations.length !== 1) return "capacity";
    const available = await new StorageUnitsRepository(tx).getAvailableCapacity(
      context.rental.facilityId,
      context.booking.unitTypeId,
      context.rental.expectedEndAt,
      newEndAt,
      { bookingId: context.booking.id, physicalUnitId: context.rental.physicalUnitId },
    );
    return available >= 1 ? null : "capacity";
  }
}
