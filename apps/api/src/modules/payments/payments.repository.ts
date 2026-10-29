import type { ManualRefundQuery } from "@metastorage/contracts";
import type { Facility, UnitType } from "@metastorage/database";
import {
  and,
  asc,
  bookings,
  capacityAllocations,
  type Database,
  desc,
  eq,
  facilities,
  gt,
  inArray,
  lte,
  or,
  type PaymentRefundReason,
  paymentProviderEvents,
  payments,
  reservations,
  type SQL,
  sql,
  unitTypes,
} from "@metastorage/database";
import { AppError } from "../../common/errors/app-error";
import { bookingCustomer, bookingReadFields } from "../bookings/bookings.projection";
import {
  bookingCode,
  bookingLocalDate,
  hashQrToken,
  qrTokenForBooking,
} from "../bookings/bookings.repository";
import type { BookingReadRecord } from "../bookings/bookings.types";
import { CheckInSlotsRepository } from "../bookings/check-in-slots.repository";
import { recordLifecycleEvent } from "../notifications/lifecycle-notifications.repository";
import { StorageUnitsRepository } from "../storage-units/storage-units.repository";
import { PAYMENT_MESSAGES } from "./payments.messages";
import type {
  BookingWebhookResult,
  PaymentStatusAccess,
  PrepareBookingPaymentInput,
  VerifiedPaymentEvent,
} from "./payments.types";

function toConfirmation(
  booking: Pick<
    BookingReadRecord,
    "id" | "bookingCode" | "checkInSlotStart" | "checkInSlotEnd" | "rentalEndAt" | "requestedMonths"
  >,
  facility: Pick<Facility, "name" | "address">,
  unitType: Pick<UnitType, "name" | "sizeLabel">,
) {
  const qrToken = qrTokenForBooking(booking.id);
  return {
    bookingId: booking.id,
    bookingCode: booking.bookingCode ?? booking.id.slice(0, 8).toUpperCase(),
    qrToken,
    qrUrl: `${process.env.PUBLIC_APP_URL ?? "http://localhost:3000"}/check-in?token=${qrToken}`,
    facility: { name: facility.name, address: facility.address },
    checkInSlotStart: booking.checkInSlotStart.toISOString(),
    checkInSlotEnd: booking.checkInSlotEnd?.toISOString() ?? null,
    rentalEndAt: booking.rentalEndAt.toISOString(),
    unitTypeName: unitType.name,
    sizeLabel: unitType.sizeLabel,
    durationMonths: booking.requestedMonths,
    emailStatus: "QUEUED" as const,
  };
}

export class PaymentsRepository {
  constructor(private readonly db: Database) {}

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
      .where(
        and(
          eq(payments.provider, "sepay"),
          eq(payments.status, "PENDING"),
          facilityId
            ? or(eq(bookings.facilityId, facilityId), eq(reservations.facilityId, facilityId))
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

  async processBookingPaymentEvent(
    event: VerifiedPaymentEvent,
  ): Promise<BookingWebhookResult | null> {
    return this.db.transaction(
      async (tx) => {
        const [candidate] = await tx
          .select({
            id: payments.id,
            bookingId: payments.bookingId,
          })
          .from(payments)
          .where(and(eq(payments.provider, "sepay"), eq(payments.paymentCode, event.paymentCode)));
        if (!candidate?.bookingId) return null;
        // Match checkout's booking -> payment -> offering lock order.
        const [checkout] = await tx
          .select({ booking: bookings, facility: facilities, unitType: unitTypes })
          .from(bookings)
          .innerJoin(facilities, eq(facilities.id, bookings.facilityId))
          .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
          .where(eq(bookings.id, candidate.bookingId))
          .for("update", { of: bookings });
        if (!checkout) throw new AppError(PAYMENT_MESSAGES.paymentMissingBookingInformation, 500);
        const [payment] = await tx
          .select()
          .from(payments)
          .where(eq(payments.id, candidate.id))
          .for("update");
        if (!payment) throw new AppError(PAYMENT_MESSAGES.paymentNotFound, 404);
        if (!payment.holdTokenHash) return null;
        const now = new Date();
        const [recorded] = await tx
          .insert(paymentProviderEvents)
          .values({
            provider: "sepay",
            providerEventId: event.providerEventId,
            paymentId: payment.id,
            paymentCode: event.paymentCode,
            amount: event.amount,
            transferType: event.transferType,
            referenceCode: event.referenceCode,
            status: "FAILED",
            payloadMetadata: event.metadata,
          })
          .onConflictDoNothing({
            target: [paymentProviderEvents.provider, paymentProviderEvents.providerEventId],
          })
          .returning();
        const [existing] = recorded
          ? [recorded]
          : await tx
              .select()
              .from(paymentProviderEvents)
              .where(
                and(
                  eq(paymentProviderEvents.provider, "sepay"),
                  eq(paymentProviderEvents.providerEventId, event.providerEventId),
                ),
              )
              .for("update");
        if (!existing) throw new AppError(PAYMENT_MESSAGES.failedToFinalizePayment, 500);
        if (!recorded && existing.status !== "FAILED")
          return { duplicate: true, processed: false, paymentId: payment.id };
        if (
          existing.paymentCode !== event.paymentCode ||
          (existing.paymentId && existing.paymentId !== payment.id)
        )
          return { duplicate: true, processed: false };
        if (
          payment.status !== "PENDING" ||
          event.successful === false ||
          event.transferType !== "in" ||
          event.amount !== Number(payment.totalAmount) ||
          (event.currency && event.currency !== payment.currency)
        ) {
          await tx
            .update(paymentProviderEvents)
            .set({ status: "IGNORED", updatedAt: now })
            .where(eq(paymentProviderEvents.id, existing.id));
          return { duplicate: false, processed: false, paymentId: payment.id };
        }
        const booking = checkout.booking;
        if (booking.status !== "DRAFT") throw new AppError(PAYMENT_MESSAGES.bookingNotDraft, 409);
        const [offering] = await tx
          .select({
            active: unitTypes.isActive,
            facilityActive: facilities.isActive,
            typeActive: unitTypes.isActive,
          })
          .from(unitTypes)
          .innerJoin(facilities, eq(facilities.id, unitTypes.facilityId))
          .where(
            and(eq(unitTypes.facilityId, booking.facilityId), eq(unitTypes.id, booking.unitTypeId)),
          )
          .for("update");
        const [hold] = await tx
          .select()
          .from(capacityAllocations)
          .where(
            and(
              eq(capacityAllocations.referenceId, booking.id),
              eq(capacityAllocations.kind, "HOLD"),
              eq(capacityAllocations.accessTokenHash, payment.holdTokenHash),
              eq(capacityAllocations.status, "ACTIVE"),
              gt(capacityAllocations.expiresAt, new Date()),
            ),
          )
          .for("update");
        let allocationId = hold?.id;
        const slots = new CheckInSlotsRepository(tx);
        const slot = await slots.findByIdForDate(booking.checkInSlotId, booking.checkInDate);
        const dayEnd = await slots.findDayEnd(booking.checkInDate);
        let refundReason: PaymentRefundReason | null = null;
        if (!slot || !dayEnd || new Date() >= dayEnd || booking.rentalEndAt <= new Date())
          refundReason = "CHECK_IN_CLOSED";
        else if (!hold) {
          if (!offering?.active || !offering.facilityActive || !offering.typeActive)
            refundReason = "OFFERING_UNAVAILABLE";
          else {
            const available = await new StorageUnitsRepository(tx).getAvailableCapacity(
              booking.facilityId,
              booking.unitTypeId,
              slot.startsAt,
              booking.rentalEndAt,
            );
            if (available < 1) refundReason = "NO_CAPACITY";
          }
          if (!refundReason) {
            // Reuse the expired hold where possible; this is a paid allocation,
            // never a renewal of the ten-minute checkout deadline.
            const [expired] = await tx
              .select({ id: capacityAllocations.id })
              .from(capacityAllocations)
              .where(
                and(
                  eq(capacityAllocations.referenceId, booking.id),
                  eq(capacityAllocations.kind, "HOLD"),
                  eq(capacityAllocations.accessTokenHash, payment.holdTokenHash),
                  inArray(capacityAllocations.status, ["ACTIVE", "EXPIRED"]),
                ),
              )
              .for("update");
            if (expired) allocationId = expired.id;
            else {
              const [created] = await tx
                .insert(capacityAllocations)
                .values({
                  facilityId: booking.facilityId,
                  unitTypeId: booking.unitTypeId,
                  referenceId: booking.id,
                  kind: "BOOKING",
                  status: "ACTIVE",
                  startsAt: slot.startsAt,
                  endsAt: booking.rentalEndAt,
                })
                .returning({ id: capacityAllocations.id });
              allocationId = created?.id;
            }
          }
        }
        if (refundReason) {
          await tx
            .update(payments)
            .set({
              status: "REFUND_PENDING",
              refundReason,
              refundAmount: payment.totalAmount,
              paidAt: now,
              providerPaymentId: event.referenceCode ?? event.providerEventId,
              updatedAt: now,
            })
            .where(eq(payments.id, payment.id));
          await tx
            .update(capacityAllocations)
            .set({ status: "RELEASED", updatedAt: now })
            .where(
              and(
                eq(capacityAllocations.referenceId, booking.id),
                eq(capacityAllocations.kind, "HOLD"),
                eq(capacityAllocations.accessTokenHash, payment.holdTokenHash),
              ),
            );
          await tx
            .update(paymentProviderEvents)
            .set({ status: "PROCESSED", paymentId: payment.id, updatedAt: now })
            .where(eq(paymentProviderEvents.id, existing.id));
          return { duplicate: false, processed: true, paymentId: payment.id };
        }
        if (!allocationId) throw new AppError(PAYMENT_MESSAGES.failedToFinalizePayment, 500);
        const [confirmed] = await tx
          .update(bookings)
          .set({
            status: "CONFIRMED",
            bookingCode: bookingCode(),
            qrTokenHash: hashQrToken(qrTokenForBooking(booking.id)),
            updatedAt: now,
          })
          .where(and(eq(bookings.id, booking.id), eq(bookings.status, "DRAFT")))
          .returning();
        if (!confirmed) throw new AppError(PAYMENT_MESSAGES.failedToFinalizePayment, 500);
        const [paid] = await tx
          .update(payments)
          .set({
            status: "SUCCEEDED",
            providerPaymentId: event.referenceCode ?? event.providerEventId,
            paidAt: now,
            updatedAt: now,
          })
          .where(and(eq(payments.id, payment.id), eq(payments.status, "PENDING")))
          .returning();
        if (!paid) throw new AppError(PAYMENT_MESSAGES.failedToFinalizePayment, 500);
        await recordLifecycleEvent(tx, {
          key: `payment:${paid.id}:confirmed`,
          type: "PAYMENT_CONFIRMED",
          bookingId: booking.id,
          occurredAt: now,
        });
        await recordLifecycleEvent(tx, {
          key: `booking:${booking.id}:confirmed`,
          type: "BOOKING_CONFIRMED",
          bookingId: booking.id,
          managers: true,
          occurredAt: now,
        });
        await tx
          .update(capacityAllocations)
          .set({
            kind: "BOOKING",
            status: "ACTIVE",
            accessTokenHash: null,
            expiresAt: null,
            updatedAt: now,
          })
          .where(eq(capacityAllocations.id, allocationId));
        await tx
          .update(paymentProviderEvents)
          .set({ status: "PROCESSED", paymentId: payment.id, updatedAt: now })
          .where(eq(paymentProviderEvents.id, existing.id));
        const [record] = await tx
          .select(bookingReadFields)
          .from(bookings)
          .innerJoin(bookingCustomer, eq(bookingCustomer.id, bookings.userId))
          .where(eq(bookings.id, booking.id));
        if (!record) throw new AppError(PAYMENT_MESSAGES.paymentMissingBookingInformation, 500);
        return {
          duplicate: false,
          processed: true,
          paymentId: paid.id,
          completed: {
            payment: paid,
            booking: record,
            confirmation: toConfirmation(record, checkout.facility, checkout.unitType),
          },
        };
      },
      { isolationLevel: "read committed" },
    );
  }

  async prepareBookingPayment(input: PrepareBookingPaymentInput) {
    return this.db.transaction(
      async (tx) => {
        const [booking] = await tx
          .select()
          .from(bookings)
          .where(and(eq(bookings.id, input.bookingId), eq(bookings.userId, input.userId)))
          .for("update");
        if (!booking) throw new AppError(PAYMENT_MESSAGES.bookingUnavailable, 404);
        if (booking.status !== "DRAFT") throw new AppError(PAYMENT_MESSAGES.bookingNotDraft, 409);

        const [existing] = await tx
          .select()
          .from(payments)
          .where(eq(payments.idempotencyKey, input.idempotencyKey))
          .for("update");
        if (existing) {
          if (existing.bookingId !== booking.id || existing.provider !== "sepay")
            throw new AppError(PAYMENT_MESSAGES.idempotencyKeyUsedForAnotherCheckout, 409);
          if (input.contactPhone && booking.contactPhone !== input.contactPhone)
            throw new AppError(PAYMENT_MESSAGES.bookingCheckoutChanged, 409);
          if (existing.status !== "PENDING")
            throw new AppError(PAYMENT_MESSAGES.paymentAttemptFinalized, 409);
          const [hold] = await tx
            .select({ expiresAt: capacityAllocations.expiresAt })
            .from(capacityAllocations)
            .where(
              and(
                eq(capacityAllocations.referenceId, booking.id),
                eq(capacityAllocations.kind, "HOLD"),
                eq(capacityAllocations.status, "ACTIVE"),
                existing.holdTokenHash
                  ? eq(capacityAllocations.accessTokenHash, existing.holdTokenHash)
                  : undefined,
                gt(capacityAllocations.expiresAt, new Date()),
              ),
            )
            .for("update");
          if (!hold?.expiresAt) throw new AppError(PAYMENT_MESSAGES.holdExpired, 409);
          return { payment: existing, expiresAt: hold.expiresAt };
        }

        const [pending] = await tx
          .select({ id: payments.id })
          .from(payments)
          .where(
            and(
              eq(payments.bookingId, booking.id),
              inArray(payments.status, ["PENDING", "REFUND_PENDING"]),
            ),
          )
          .limit(1);
        // A pending transfer may still arrive after hold expiry. Do not create another charge.
        if (pending) throw new AppError(PAYMENT_MESSAGES.paymentPendingReconciliation, 409);
        if (booking.checkInDate <= bookingLocalDate())
          throw new AppError(PAYMENT_MESSAGES.checkInTomorrow, 409);

        // Every booking checkout for this facility/type locks the same row before counting
        // allocations. READ COMMITTED sees the preceding checkout's committed hold.
        const [offering] = await tx
          .select({
            active: unitTypes.isActive,
            facilityActive: facilities.isActive,
            typeActive: unitTypes.isActive,
          })
          .from(unitTypes)
          .innerJoin(facilities, eq(facilities.id, unitTypes.facilityId))
          .where(
            and(eq(unitTypes.facilityId, booking.facilityId), eq(unitTypes.id, booking.unitTypeId)),
          )
          .for("update");
        if (!offering?.active || !offering.facilityActive || !offering.typeActive)
          throw new AppError(PAYMENT_MESSAGES.bookingOfferingUnavailable, 409);
        const now = new Date();
        const slot = await new CheckInSlotsRepository(tx).findByIdForDate(
          booking.checkInSlotId,
          booking.checkInDate,
        );
        if (
          !slot ||
          slot.startsAt <= now ||
          slot.endsAt <= slot.startsAt ||
          booking.rentalEndAt <= slot.startsAt
        )
          throw new AppError(PAYMENT_MESSAGES.bookingScheduleUnavailable, 409);
        const available = await new StorageUnitsRepository(tx).getAvailableCapacity(
          booking.facilityId,
          booking.unitTypeId,
          slot.startsAt,
          booking.rentalEndAt,
        );
        if (available <= 0) throw new AppError(PAYMENT_MESSAGES.bookingCapacityUnavailable, 409);

        const [customer] = await tx
          .select({ phone: bookingCustomer.phone })
          .from(bookingCustomer)
          .where(eq(bookingCustomer.id, input.userId));
        const contactPhone = input.contactPhone ?? customer?.phone;
        if (!contactPhone || !/^(?:\+[1-9]\d{7,14}|0\d{9})$/.test(contactPhone))
          throw new AppError(PAYMENT_MESSAGES.bookingPhoneRequired, 400, "BOOKING_PHONE_REQUIRED");
        const expiresAt = new Date(now.getTime() + input.holdDurationMs);
        await tx.insert(capacityAllocations).values({
          referenceId: booking.id,
          facilityId: booking.facilityId,
          unitTypeId: booking.unitTypeId,
          kind: "HOLD",
          status: "ACTIVE",
          accessTokenHash: input.holdTokenHash,
          startsAt: slot.startsAt,
          endsAt: booking.rentalEndAt,
          expiresAt,
        });
        await tx
          .update(bookings)
          .set({
            contactPhone,
            updatedAt: now,
          })
          .where(eq(bookings.id, booking.id));
        const [payment] = await tx
          .insert(payments)
          .values({
            bookingId: booking.id,
            holdTokenHash: input.holdTokenHash,
            provider: "sepay",
            paymentCode: input.paymentCode,
            providerPaymentId: `pending_${input.paymentCode}`,
            idempotencyKey: input.idempotencyKey,
            totalAmount: booking.totalAmount,
            currency: "VND",
            status: "PENDING",
          })
          .onConflictDoNothing({ target: payments.idempotencyKey })
          .returning();
        if (!payment)
          throw new AppError(PAYMENT_MESSAGES.idempotencyKeyUsedForAnotherCheckout, 409);
        return { payment, expiresAt };
      },
      { isolationLevel: "read committed" },
    );
  }

  async listManualRefunds(query: ManualRefundQuery) {
    return this.db
      .select({
        paymentId: payments.id,
        bookingId: payments.bookingId,
        reservationId: payments.reservationId,
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
      .leftJoin(bookings, eq(bookings.id, payments.bookingId))
      .leftJoin(reservations, eq(reservations.id, payments.reservationId))
      .leftJoin(
        bookingCustomer,
        eq(bookingCustomer.id, sql`coalesce(${bookings.userId}, ${reservations.customerId})`),
      )
      .where(eq(payments.status, "REFUND_PENDING"))
      .orderBy(desc(payments.paidAt), payments.id)
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

  async findCompletedByPaymentId(paymentId: string) {
    return this.findCompleted(eq(payments.id, paymentId));
  }

  private async findCompleted(condition: SQL | undefined) {
    const [result] = await this.db
      .select({
        payment: payments,
        booking: bookingReadFields,
        facility: facilities,
        unitType: unitTypes,
      })
      .from(payments)
      .innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .innerJoin(bookingCustomer, eq(bookingCustomer.id, bookings.userId))
      .innerJoin(facilities, eq(facilities.id, bookings.facilityId))
      .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
      .where(condition);
    return result
      ? {
          ...result,
          confirmation: toConfirmation(result.booking, result.facility, result.unitType),
        }
      : undefined;
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
      .where(
        and(
          eq(payments.id, paymentId),
          or(eq(bookings.userId, access.userId), eq(reservations.customerId, access.userId)),
        ),
      );
    return row?.payment;
  }

  async findActiveHoldForPayment(payment: typeof payments.$inferSelect) {
    const referenceId = payment.bookingId ?? payment.reservationId;
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
