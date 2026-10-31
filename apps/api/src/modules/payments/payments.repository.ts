import type { DebtQuery, ManualRefundQuery } from "@metastorage/contracts";
import {
  alias,
  and,
  asc,
  bookings,
  capacityAllocations,
  count,
  type Database,
  DebtStatus,
  debts,
  desc,
  eq,
  gt,
  inArray,
  lte,
  or,
  paymentProviderEvents,
  payments,
  rentalRenewals,
  rentals,
  reservations,
  returnSettlements,
  sql,
  storageUnits,
  users,
} from "@metastorage/database";
import { AppError } from "../../common/errors/app-error";

const bookingCustomer = alias(users, "booking_customer");

import { PAYMENT_MESSAGES } from "./payments.messages";
import type { PaymentStatusAccess, VerifiedPaymentEvent } from "./payments.types";

export class PaymentsRepository {
  constructor(private readonly db: Database) {}

  transaction<T>(
    callback: (tx: Parameters<Parameters<Database["transaction"]>[0]>[0]) => Promise<T>,
  ) {
    return this.db.transaction(callback);
  }

  private debtFilter(scope: { customerId?: string; facilityIds?: string[] }, query: DebtQuery) {
    return and(
      scope.customerId
        ? eq(rentals.userId, scope.customerId)
        : inArray(storageUnits.facilityId, scope.facilityIds ?? []),
      query.rentalId ? eq(rentals.id, query.rentalId) : undefined,
      query.status ? eq(debts.status, DebtStatus[query.status]) : undefined,
    );
  }

  async listDebts(scope: { customerId?: string; facilityIds?: string[] }, query: DebtQuery) {
    const filter = this.debtFilter(scope, query);
    const rows = await this.db
      .select({
        debt: debts,
        rentalId: rentals.id,
        customerId: rentals.userId,
        customerName: users.name,
        unitCode: storageUnits.code,
        currency: returnSettlements.currency,
        total: sql<number>`count(*) over()`.mapWith(Number),
      })
      .from(debts)
      .innerJoin(returnSettlements, eq(returnSettlements.id, debts.settlementId))
      .innerJoin(rentals, eq(rentals.id, returnSettlements.rentalId))
      .innerJoin(storageUnits, eq(storageUnits.id, rentals.storageUnitId))
      .innerJoin(users, eq(users.id, rentals.userId))
      .where(filter)
      .orderBy(desc(debts.createdAt), debts.id)
      .limit(query.limit)
      .offset(query.offset);
    if (rows.length) return { items: rows, total: rows[0]?.total ?? 0 };
    const [total] = await this.db
      .select({ value: count() })
      .from(debts)
      .innerJoin(returnSettlements, eq(returnSettlements.id, debts.settlementId))
      .innerJoin(rentals, eq(rentals.id, returnSettlements.rentalId))
      .innerJoin(storageUnits, eq(storageUnits.id, rentals.storageUnitId))
      .where(filter);
    return { items: rows, total: total?.value ?? 0 };
  }

  async findDebt(
    id: string,
    executor: Database | Parameters<Parameters<Database["transaction"]>[0]>[0] = this.db,
  ) {
    const [row] = await executor
      .select({
        debt: debts,
        rentalId: rentals.id,
        customerId: rentals.userId,
        customerName: users.name,
        unitCode: storageUnits.code,
        facilityId: storageUnits.facilityId,
        currency: returnSettlements.currency,
      })
      .from(debts)
      .innerJoin(returnSettlements, eq(returnSettlements.id, debts.settlementId))
      .innerJoin(rentals, eq(rentals.id, returnSettlements.rentalId))
      .innerJoin(storageUnits, eq(storageUnits.id, rentals.storageUnitId))
      .innerJoin(users, eq(users.id, rentals.userId))
      .where(eq(debts.id, id));
    return row;
  }

  listDebtPayments(id: string) {
    return this.db
      .select({
        id: payments.id,
        totalAmount: payments.totalAmount,
        method: payments.method,
        reference: payments.reference,
        paidAt: payments.paidAt,
      })
      .from(payments)
      .where(eq(payments.debtId, id))
      .orderBy(desc(payments.paidAt), payments.id);
  }

  async lockDebt(tx: Parameters<Parameters<Database["transaction"]>[0]>[0], id: string) {
    const [row] = await tx.select().from(debts).where(eq(debts.id, id)).for("update");
    return row;
  }

  async findDebtPayment(tx: Parameters<Parameters<Database["transaction"]>[0]>[0], key: string) {
    const [row] = await tx.select().from(payments).where(eq(payments.idempotencyKey, key));
    return row;
  }

  insertDebtPayment(
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
    input: typeof payments.$inferInsert,
  ) {
    return tx
      .insert(payments)
      .values(input)
      .onConflictDoNothing({ target: payments.idempotencyKey })
      .returning();
  }

  updateDebt(
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
    id: string,
    input: Pick<typeof debts.$inferInsert, "paidAmount" | "status" | "updatedAt">,
  ) {
    return tx.update(debts).set(input).where(eq(debts.id, id));
  }

  async findRenewalRentalId(renewalId: string) {
    const [row] = await this.db
      .select({ rentalId: rentalRenewals.rentalId })
      .from(rentalRenewals)
      .where(eq(rentalRenewals.id, renewalId));
    return row?.rentalId;
  }

  async recordEventInTransaction(
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
    event: VerifiedPaymentEvent,
    paymentId: string,
  ) {
    const [recorded] = await tx
      .insert(paymentProviderEvents)
      .values({
        provider: "sepay",
        providerEventId: event.providerEventId,
        paymentId,
        paymentCode: event.paymentCode,
        amount: event.amount,
        transferType: event.transferType,
        referenceCode: event.referenceCode,
        status: "PROCESSED",
        payloadMetadata: event.metadata,
      })
      .onConflictDoNothing({
        target: [paymentProviderEvents.provider, paymentProviderEvents.providerEventId],
      })
      .returning();
    return Boolean(recorded);
  }

  async listPendingSepayPayments(facilityId?: string) {
    return this.db
      .select({ id: payments.id })
      .from(payments)
      .leftJoin(bookings, eq(bookings.id, payments.bookingId))
      .leftJoin(reservations, eq(reservations.id, payments.reservationId))
      .leftJoin(rentalRenewals, eq(rentalRenewals.id, payments.renewalId))
      .leftJoin(rentals, eq(rentals.id, rentalRenewals.rentalId))
      .leftJoin(storageUnits, eq(storageUnits.id, rentals.storageUnitId))
      .where(
        and(
          eq(payments.provider, "sepay"),
          eq(payments.status, "PENDING"),
          facilityId
            ? or(
                eq(bookings.facilityId, facilityId),
                eq(reservations.facilityId, facilityId),
                eq(storageUnits.facilityId, facilityId),
              )
            : undefined,
        ),
      )
      .orderBy(asc(payments.updatedAt), asc(payments.id))
      .limit(10);
  }

  async claimPaymentReconciliation(paymentId: string) {
    // updatedAt doubles as a short lookup lease, without holding a transaction
    // open over HTTP. An atomic predicate also throttles multiple API instances.
    // Rotate checked rows to the back of the sweep, including missing orders.
    const now = new Date();
    const [payment] = await this.db
      .update(payments)
      .set({
        // Timestamp arithmetic has no Drizzle helper. Always leave the initial
        // createdAt === updatedAt state, even for a same-millisecond first poll.
        updatedAt: sql`greatest(${now.toISOString()}::timestamptz, ${payments.createdAt} + interval '1 millisecond')`,
      })
      .where(
        and(
          eq(payments.id, paymentId),
          eq(payments.provider, "sepay"),
          eq(payments.status, "PENDING"),

          or(
            eq(payments.updatedAt, payments.createdAt),
            lte(payments.updatedAt, new Date(now.getTime() - 15_000)),
          ),
        ),
      )
      .returning();
    return payment;
  }

  async listManualRefunds(query: ManualRefundQuery) {
    return this.db
      .select({
        paymentId: payments.id,
        type: payments.type,
        bookingId: sql<string | null>`coalesce(${payments.bookingId}, ${rentals.bookingId})`,
        reservationId: sql<
          string | null
        >`coalesce(${payments.reservationId}, ${rentals.reservationId})`,
        amount: sql<string>`coalesce(${payments.refundAmount}, ${payments.totalAmount})`,
        depositForfeitedAmount: payments.depositForfeitedAmount,
        currency: payments.currency,
        reason: payments.refundReason,
        paidAt: payments.paidAt,
        contactName: bookingCustomer.name,
        contactEmail: bookingCustomer.email,
        contactPhone: sql<
          string | null
        >`coalesce(${bookings.contactPhone}, ${bookingCustomer.phone})`,
      })
      .from(payments)
      .leftJoin(rentalRenewals, eq(rentalRenewals.id, payments.renewalId))
      .leftJoin(
        rentals,
        or(eq(rentals.id, payments.rentalId), eq(rentals.id, rentalRenewals.rentalId)),
      )
      .leftJoin(
        bookings,
        eq(bookings.id, sql`coalesce(${payments.bookingId}, ${rentals.bookingId})`),
      )
      .leftJoin(
        reservations,
        eq(reservations.id, sql`coalesce(${payments.reservationId}, ${rentals.reservationId})`),
      )
      .leftJoin(
        bookingCustomer,
        eq(
          bookingCustomer.id,
          sql`coalesce(${bookings.userId}, ${reservations.customerId}, ${rentals.userId})`,
        ),
      )
      .where(eq(payments.status, "REFUND_PENDING"))
      .orderBy(desc(sql`coalesce(${payments.paidAt}, ${payments.createdAt})`), payments.id)
      .limit(query.limit)
      .offset(query.offset);
  }

  async confirmManualRefund(paymentId: string, reference: string, actorId: string) {
    return this.db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .for("update");
      if (!payment) throw new AppError(PAYMENT_MESSAGES.paymentNotFound, 404);
      if (
        payment.status === "REFUNDED" &&
        payment.refundReference &&
        payment.refundedAt &&
        payment.refundedBy
      ) {
        if (payment.refundReference !== reference)
          throw new AppError(PAYMENT_MESSAGES.refundReferenceConflict, 409);
        return payment;
      }
      if (payment.status !== "REFUND_PENDING")
        throw new AppError(PAYMENT_MESSAGES.refundNotPending, 409);
      const now = new Date();
      const [refunded] = await tx
        .update(payments)
        .set({
          status: "REFUNDED",
          refundReference: reference,
          refundedAt: now,
          refundedBy: actorId,
          updatedAt: now,
        })
        .where(and(eq(payments.id, paymentId), eq(payments.status, "REFUND_PENDING")))
        .returning();
      if (!refunded) throw new AppError(PAYMENT_MESSAGES.refundNotPending, 409);
      return refunded;
    });
  }

  async findPendingByPaymentCode(paymentCode: string) {
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.paymentCode, paymentCode), eq(payments.status, "PENDING")));
    return payment;
  }

  async findPayment(paymentId: string) {
    const [payment] = await this.db.select().from(payments).where(eq(payments.id, paymentId));
    return payment;
  }

  async findPaymentForStatus(paymentId: string, access: PaymentStatusAccess) {
    if (!access.userId) return undefined;
    const [row] = await this.db
      .select({ payment: payments })
      .from(payments)
      .leftJoin(bookings, eq(bookings.id, payments.bookingId))
      .leftJoin(reservations, eq(reservations.id, payments.reservationId))
      .leftJoin(rentalRenewals, eq(rentalRenewals.id, payments.renewalId))
      .leftJoin(
        rentals,
        or(eq(rentals.id, rentalRenewals.rentalId), eq(rentals.id, payments.rentalId)),
      )
      .where(
        and(
          eq(payments.id, paymentId),
          or(
            eq(bookings.userId, access.userId),
            eq(reservations.customerId, access.userId),
            eq(rentals.userId, access.userId),
          ),
        ),
      );
    return row?.payment;
  }

  async findActiveHoldForPayment(payment: typeof payments.$inferSelect) {
    const referenceId = payment.bookingId ?? payment.reservationId ?? payment.renewalId;
    if (!payment.holdTokenHash || !referenceId) return null;
    const [hold] = await this.db
      .select({ id: capacityAllocations.id, expiresAt: capacityAllocations.expiresAt })
      .from(capacityAllocations)
      .where(
        and(
          eq(capacityAllocations.referenceId, referenceId),
          eq(capacityAllocations.kind, "HOLD"),
          eq(capacityAllocations.status, "ACTIVE"),
          eq(capacityAllocations.accessTokenHash, payment.holdTokenHash),
          gt(capacityAllocations.expiresAt, new Date()),
        ),
      );
    return hold ?? null;
  }

  async recordProviderEvent(input: {
    provider: string;
    providerEventId: string;
    paymentId: string | null;
    paymentCode: string;
    amount: number;
    transferType: string;
    referenceCode: string | null;
    status: "PROCESSED" | "IGNORED" | "FAILED";
    payloadMetadata: Record<string, unknown>;
  }) {
    const [event] = await this.db
      .insert(paymentProviderEvents)
      .values(input)
      .onConflictDoNothing({
        target: [paymentProviderEvents.provider, paymentProviderEvents.providerEventId],
      })
      .returning();
    return event ?? null;
  }

  async findProviderEvent(provider: string, providerEventId: string) {
    const [event] = await this.db
      .select()
      .from(paymentProviderEvents)
      .where(
        and(
          eq(paymentProviderEvents.provider, provider),
          eq(paymentProviderEvents.providerEventId, providerEventId),
        ),
      );
    return event;
  }

  async updateProviderEvent(
    eventId: string,
    status: "PROCESSED" | "IGNORED" | "FAILED",
    paymentId?: string,
  ) {
    await this.db
      .update(paymentProviderEvents)
      .set({ status, paymentId, updatedAt: new Date() })
      .where(eq(paymentProviderEvents.id, eventId));
  }
}
