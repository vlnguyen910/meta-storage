import { createHash, createHmac, randomBytes } from "node:crypto";
import type { Facility, UnitType } from "@metastorage/database";
import {
  and,
  bookings,
  capacityAllocations,
  type Database,
  eq,
  facilities,
  gt,
  paymentProviderEvents,
  payments,
  reservationDrafts,
  unitTypes,
} from "@metastorage/database";
import { AppError } from "../../common/errors/app-error";
import { bookingReadFields } from "../bookings/bookings.projection";
import type { BookingReadRecord } from "../bookings/bookings.types";
import { CheckInSlotsRepository } from "../bookings/check-in-slots.repository";
import { PAYMENT_MESSAGES } from "./payments.messages";

export type PricingSnapshot = {
  monthlyRateSnapshot: string;
  rentalFeeAmount: string;
  depositAmount: string;
  totalAmount: string;
  currency: string;
};

function bookingCode() {
  return `SX-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function hashQrToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function qrTokenForBooking(bookingId: string) {
  return createHmac("sha256", process.env.QR_TOKEN_SECRET ?? "storex-dev-qr-secret")
    .update(bookingId)
    .digest("hex");
}

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

  async findDraftPricing(draftId: string): Promise<PricingSnapshot | null> {
    const [draft] = await this.db
      .select({ pricing: reservationDrafts.pricing })
      .from(reservationDrafts)
      .where(eq(reservationDrafts.id, draftId));
    return draft?.pricing ?? null;
  }

  async findCheckout(draftId: string, holdTokenHash: string) {
    const [checkout] = await this.db
      .select({ draft: reservationDrafts, hold: capacityAllocations })
      .from(reservationDrafts)
      .innerJoin(
        capacityAllocations,
        and(
          eq(capacityAllocations.referenceId, reservationDrafts.id),
          eq(capacityAllocations.kind, "HOLD"),
          eq(capacityAllocations.status, "ACTIVE"),
          eq(capacityAllocations.accessTokenHash, holdTokenHash),
        ),
      )
      .where(eq(reservationDrafts.id, draftId));
    if (!checkout) return undefined;
    const slot = await new CheckInSlotsRepository(this.db).findForCheckIn(checkout.draft.checkInAt);
    if (!slot || slot.startsAt.getTime() !== checkout.draft.checkInAt.getTime()) {
      throw new AppError(
        PAYMENT_MESSAGES.checkoutScheduleRequiresNewDraft,
        409,
        "CHECK_IN_SLOT_CHANGED",
      );
    }
    return checkout;
  }

  async findByIdempotencyKey(idempotencyKey: string) {
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.idempotencyKey, idempotencyKey));
    return payment;
  }

  async findCompletedByIdempotencyKey(
    idempotencyKey: string,
    draftId: string,
    holdTokenHash: string,
  ) {
    const [result] = await this.db
      .select({
        payment: payments,
        booking: bookingReadFields,
        facility: facilities,
        unitType: unitTypes,
      })
      .from(payments)
      .innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .innerJoin(facilities, eq(facilities.id, bookings.facilityId))
      .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
      .where(
        and(
          eq(payments.idempotencyKey, idempotencyKey),
          eq(payments.draftId, draftId),
          eq(payments.holdTokenHash, holdTokenHash),
          eq(payments.status, "SUCCEEDED"),
        ),
      );
    return result
      ? {
          ...result,
          confirmation: toConfirmation(result.booking, result.facility, result.unitType),
        }
      : undefined;
  }

  async createPendingPayment(input: {
    draftId: string;
    holdTokenHash: string;
    provider: string;
    idempotencyKey: string;
    pricing: PricingSnapshot;
    paymentCode: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [checkout] = await tx
        .select({ draft: reservationDrafts, hold: capacityAllocations })
        .from(reservationDrafts)
        .innerJoin(
          capacityAllocations,
          and(
            eq(capacityAllocations.referenceId, reservationDrafts.id),
            eq(capacityAllocations.kind, "HOLD"),
            eq(capacityAllocations.status, "ACTIVE"),
            eq(capacityAllocations.accessTokenHash, input.holdTokenHash),
            gt(capacityAllocations.expiresAt, new Date()),
          ),
        )
        .where(eq(reservationDrafts.id, input.draftId))
        .for("update");
      if (!checkout) return null;

      const slot = await new CheckInSlotsRepository(tx).findForCheckIn(checkout.draft.checkInAt);
      if (!slot || slot.startsAt.getTime() !== checkout.draft.checkInAt.getTime()) {
        throw new AppError(
          PAYMENT_MESSAGES.checkoutScheduleRequiresNewDraft,
          409,
          "CHECK_IN_SLOT_CHANGED",
        );
      }

      const values = {
        draftId: input.draftId,
        holdTokenHash: input.holdTokenHash,
        provider: input.provider,
        paymentCode: input.paymentCode,
        providerPaymentId: `pending_${input.idempotencyKey}`,
        idempotencyKey: input.idempotencyKey,
        totalAmount: input.pricing.totalAmount,
        currency: input.pricing.currency,
        status: "PENDING" as const,
      };
      const [createdPayment] = await tx
        .insert(payments)
        .values(values)
        .onConflictDoNothing({ target: payments.idempotencyKey })
        .returning();
      const [payment] = createdPayment
        ? [createdPayment]
        : await tx
            .select()
            .from(payments)
            .where(eq(payments.idempotencyKey, input.idempotencyKey))
            .for("update");
      if (!payment) throw new Error(PAYMENT_MESSAGES.failedToCreatePendingPayment);
      return { payment, checkout };
    });
  }

  async markFailed(paymentId: string) {
    const [payment] = await this.db
      .update(payments)
      .set({ status: "FAILED", updatedAt: new Date() })
      .where(and(eq(payments.id, paymentId), eq(payments.status, "PENDING")))
      .returning();
    return payment;
  }

  async findCompletedByPaymentId(paymentId: string) {
    const [result] = await this.db
      .select({
        payment: payments,
        booking: bookingReadFields,
        facility: facilities,
        unitType: unitTypes,
      })
      .from(payments)
      .innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .innerJoin(facilities, eq(facilities.id, bookings.facilityId))
      .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
      .where(eq(payments.id, paymentId));
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

  async findActiveHoldForPayment(payment: typeof payments.$inferSelect) {
    if (!payment.draftId) return null;
    const [hold] = await this.db
      .select({ id: capacityAllocations.id, expiresAt: capacityAllocations.expiresAt })
      .from(capacityAllocations)
      .where(
        and(
          eq(capacityAllocations.referenceId, payment.draftId),
          eq(capacityAllocations.kind, "HOLD"),
          eq(capacityAllocations.status, "ACTIVE"),
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

  async completePendingPayment(input: {
    paymentId: string;
    providerPaymentId: string;
    draftId: string | null;
    holdId: string;
    paidAt: Date;
  }) {
    // Booking-only checkout is finalized by the Payment refactor, not the legacy writer.
    const draftId = input.draftId;
    if (!draftId) return null;
    return this.db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.id, input.paymentId),
            eq(payments.draftId, draftId),
            eq(payments.status, "PENDING"),
          ),
        )
        .for("update");
      if (!payment) return null;

      const [checkout] = await tx
        .select({
          draft: reservationDrafts,
          hold: capacityAllocations,
          facility: facilities,
          unitType: unitTypes,
        })
        .from(reservationDrafts)
        .innerJoin(facilities, eq(facilities.id, reservationDrafts.facilityId))
        .innerJoin(unitTypes, eq(unitTypes.id, reservationDrafts.unitTypeId))
        .innerJoin(
          capacityAllocations,
          and(
            eq(capacityAllocations.id, input.holdId),
            eq(capacityAllocations.referenceId, reservationDrafts.id),
            eq(capacityAllocations.kind, "HOLD"),
            eq(capacityAllocations.status, "ACTIVE"),
          ),
        )
        .where(eq(reservationDrafts.id, draftId))
        .for("update");
      if (!checkout) return null;

      const pricing = checkout.draft.pricing;
      if (!pricing) throw new Error(PAYMENT_MESSAGES.pricingNotConfigured);
      const slot = await new CheckInSlotsRepository(tx).findForCheckIn(checkout.draft.checkInAt);
      if (!slot || slot.startsAt.getTime() !== checkout.draft.checkInAt.getTime()) {
        throw new AppError(
          PAYMENT_MESSAGES.checkoutScheduleRequiresNewDraft,
          409,
          "CHECK_IN_SLOT_CHANGED",
        );
      }

      const [booking] = await tx
        .insert(bookings)
        .values({
          bookingCode: bookingCode(),
          contactName: checkout.draft.contactName,
          contactEmail: checkout.draft.contactEmail,
          contactPhone: checkout.draft.contactPhone,
          facilityId: checkout.draft.facilityId,
          unitTypeId: checkout.draft.unitTypeId,
          requestedMonths: checkout.draft.durationMonths,
          checkInDate: slot.checkInDate,
          checkInSlotId: slot.id,
          rentalEndAt: checkout.draft.rentalEndAt,
          monthlyRateSnapshot: pricing.monthlyRateSnapshot,
          rentalFeeAmount: pricing.rentalFeeAmount,
          depositAmount: pricing.depositAmount,
          totalAmount: payment.totalAmount,
          status: "CONFIRMED",
        })
        .returning();
      if (!booking) throw new Error(PAYMENT_MESSAGES.failedToCreateBookingAfterPayment);

      const qrToken = qrTokenForBooking(booking.id);
      await tx
        .update(bookings)
        .set({ qrTokenHash: hashQrToken(qrToken), updatedAt: input.paidAt })
        .where(eq(bookings.id, booking.id));

      const [updatedPayment] = await tx
        .update(payments)
        .set({
          bookingId: booking.id,
          providerPaymentId: input.providerPaymentId,
          status: "SUCCEEDED",
          paidAt: input.paidAt,
          updatedAt: input.paidAt,
        })
        .where(eq(payments.id, payment.id))
        .returning();
      if (!updatedPayment) throw new Error(PAYMENT_MESSAGES.failedToFinalizePayment);

      await tx
        .update(capacityAllocations)
        .set({
          kind: "BOOKING",
          referenceId: booking.id,
          accessTokenHash: null,
          expiresAt: null,
          updatedAt: input.paidAt,
        })
        .where(eq(capacityAllocations.id, input.holdId));

      const [bookingRecord] = await tx
        .select(bookingReadFields)
        .from(bookings)
        .where(eq(bookings.id, booking.id));
      if (!bookingRecord) throw new Error(PAYMENT_MESSAGES.paymentMissingBookingInformation);

      return {
        payment: updatedPayment,
        booking: bookingRecord,
        confirmation: toConfirmation(bookingRecord, checkout.facility, checkout.unitType),
      };
    });
  }
}
