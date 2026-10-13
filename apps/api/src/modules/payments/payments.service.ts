import { createHash, randomBytes } from "node:crypto";
import type {
  BookingConfirmation,
  PaidBooking,
  PaymentCheckoutInput,
  PaymentPendingResponse,
  PaymentResult,
  PaymentStatusResponse,
} from "@metastorage/contracts";
import type { Payment } from "@metastorage/database";
import { AppError, NotFoundError } from "../../common/errors/app-error";
import type { BookingEmailService } from "../bookings/booking-email.service";
import type { BookingReadRecord } from "../bookings/bookings.types";
import { MockPaymentGateway, type PaymentGateway } from "./payment-mock.gateway";
import { PAYMENT_MESSAGES } from "./payments.messages";
import type { PaymentsRepository } from "./payments.repository";
import type { CompletedPayment, PricingSnapshot } from "./payments.types";
import type { SepayPaymentGateway } from "./sepay.gateway";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export class PaymentsService {
  constructor(
    private readonly repository: PaymentsRepository,
    private readonly gateway: PaymentGateway = new MockPaymentGateway(),
    private readonly pricingProvider: (
      draftId: string,
    ) => Promise<PricingSnapshot | null> = async () => null,
    private readonly sepayGateway?: SepayPaymentGateway,
    private readonly bookingEmail?: BookingEmailService,
  ) {}

  private async confirmationWithEmail(completed: {
    booking: BookingReadRecord;
    confirmation: BookingConfirmation;
  }): Promise<BookingConfirmation> {
    const emailStatus =
      (await this.bookingEmail?.enqueueConfirmation(completed.booking, completed.confirmation)) ??
      "FAILED";
    return { ...completed.confirmation, emailStatus };
  }

  private async completedResult(completed: CompletedPayment | undefined): Promise<PaymentResult> {
    if (!completed?.payment.paidAt || !completed.booking.bookingCode || !completed.booking.paidAt) {
      throw new AppError(PAYMENT_MESSAGES.paymentMissingBookingInformation, 500);
    }
    return toPaymentResult(
      { ...completed.payment, paidAt: completed.payment.paidAt },
      {
        ...completed.booking,
        bookingCode: completed.booking.bookingCode,
        paidAt: completed.booking.paidAt,
      },
      await this.confirmationWithEmail(completed),
    );
  }

  private pendingResponse(
    payment: Payment,
    draftId: string,
    expiresAt: Date | null,
  ): PaymentPendingResponse {
    if (!this.sepayGateway)
      throw new AppError(PAYMENT_MESSAGES.sepayUnavailable, 503, "PAYMENT_PROVIDER_UNAVAILABLE");
    const instructions = this.sepayGateway.createInstructions({
      paymentCode: payment.paymentCode,
      amount: payment.totalAmount,
      currency: payment.currency,
      expiresAt: expiresAt ?? new Date(Date.now() + 10 * 60_000),
    });
    const session = this.sepayGateway.createCheckoutSession({
      paymentCode: payment.paymentCode,
      amount: Number(payment.totalAmount),
      currency: payment.currency,
      description: PAYMENT_MESSAGES.checkoutDescription(payment.paymentCode),
      draftId,
      paymentId: payment.id,
    });
    return {
      paymentId: payment.id,
      status: "PENDING",
      provider: "sepay",
      paymentCode: payment.paymentCode,
      transferInstructions: instructions,
      checkoutUrl: session?.checkoutUrl,
      checkoutFormFields: session?.formFields,
      expiresAt: instructions.expiresAt,
    };
  }

  async pay(draftId: string, input: PaymentCheckoutInput): Promise<PaymentResult> {
    const holdTokenHash = hashToken(input.holdToken);
    const existing = await this.repository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (existing.draftId !== draftId || existing.holdTokenHash !== holdTokenHash) {
        throw new AppError(
          PAYMENT_MESSAGES.idempotencyKeyUsedForAnotherCheckout,
          409,
          "IDEMPOTENCY_KEY_REUSED",
        );
      }
      if (existing.status === "PENDING") {
        throw new AppError(PAYMENT_MESSAGES.paymentPendingReconciliation, 409, "PAYMENT_PENDING");
      }
      if (existing.status !== "SUCCEEDED") {
        throw new AppError(
          PAYMENT_MESSAGES.paymentAttemptFinalized,
          409,
          "PAYMENT_ATTEMPT_FINALIZED",
        );
      }
      const completed = await this.repository.findCompletedByIdempotencyKey(
        input.idempotencyKey,
        draftId,
        holdTokenHash,
      );
      return this.completedResult(completed);
    }

    const checkout = await this.repository.findCheckout(draftId, holdTokenHash);
    if (!checkout) throw new NotFoundError(PAYMENT_MESSAGES.holdUnavailable);
    if (checkout.hold.expiresAt && checkout.hold.expiresAt <= new Date()) {
      throw new AppError(PAYMENT_MESSAGES.holdExpired, 409, "HOLD_EXPIRED");
    }

    const pricing = await this.pricingProvider(draftId);
    if (!pricing)
      throw new AppError(PAYMENT_MESSAGES.pricingNotConfigured, 409, "PRICING_NOT_CONFIGURED");

    const pending = await this.repository.createPendingPayment({
      draftId,
      holdTokenHash,
      provider: this.gateway.provider,
      paymentCode: `MOCK${input.idempotencyKey.slice(-12).toUpperCase()}`,
      idempotencyKey: input.idempotencyKey,
      pricing,
    });
    if (!pending) throw new AppError(PAYMENT_MESSAGES.holdNoLongerAvailable, 409, "HOLD_EXPIRED");
    if (pending.payment.status !== "PENDING") {
      throw new AppError(
        PAYMENT_MESSAGES.idempotencyKeyAlreadyProcessed,
        409,
        "IDEMPOTENCY_KEY_REUSED",
      );
    }

    const gatewayResult = await this.gateway.charge({
      amount: pricing.totalAmount,
      currency: pricing.currency,
      paymentMethodToken: input.paymentMethodToken,
      idempotencyKey: input.idempotencyKey,
    });
    if (
      !gatewayResult?.providerPaymentId ||
      !["SUCCEEDED", "FAILED"].includes(gatewayResult.status)
    ) {
      throw new AppError(PAYMENT_MESSAGES.paymentGatewayResultUnknown, 503, "PAYMENT_UNCERTAIN");
    }
    if (gatewayResult.status === "FAILED") {
      await this.repository.markFailed(pending.payment.id);
      throw new AppError(PAYMENT_MESSAGES.paymentFailed, 402, "PAYMENT_FAILED");
    }

    let completedCheckout: Awaited<ReturnType<PaymentsRepository["completePendingPayment"]>>;
    try {
      completedCheckout = await this.repository.completePendingPayment({
        paymentId: pending.payment.id,
        draftId,
        holdId: checkout.hold.id,
        providerPaymentId: gatewayResult.providerPaymentId,
        paidAt: new Date(),
      });
    } catch {
      throw new AppError(
        PAYMENT_MESSAGES.paymentReceivedPendingReconciliation,
        503,
        "PAYMENT_UNCERTAIN",
      );
    }
    if (!completedCheckout?.booking) {
      throw new AppError(
        PAYMENT_MESSAGES.paymentReceivedPendingReconciliation,
        503,
        "PAYMENT_UNCERTAIN",
      );
    }
    if (!completedCheckout.payment.paidAt)
      throw new AppError(PAYMENT_MESSAGES.paymentTimestampMissing, 500);
    if (!completedCheckout.booking.bookingCode || !completedCheckout.booking.paidAt)
      throw new AppError(PAYMENT_MESSAGES.bookingPaymentInformationMissing, 500);

    return this.completedResult(completedCheckout);
  }

  async startSepayPayment(
    draftId: string,
    input: PaymentCheckoutInput,
  ): Promise<PaymentPendingResponse> {
    if (!this.sepayGateway)
      throw new AppError(PAYMENT_MESSAGES.sepayUnavailable, 503, "PAYMENT_PROVIDER_UNAVAILABLE");
    const holdTokenHash = hashToken(input.holdToken);
    const existing = await this.repository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (existing.draftId !== draftId || existing.holdTokenHash !== holdTokenHash) {
        throw new AppError(
          PAYMENT_MESSAGES.idempotencyKeyUsedForAnotherCheckout,
          409,
          "IDEMPOTENCY_KEY_REUSED",
        );
      }
      if (existing.status !== "PENDING") {
        throw new AppError(
          PAYMENT_MESSAGES.paymentAttemptFinalized,
          409,
          "PAYMENT_ATTEMPT_FINALIZED",
        );
      }
      const existingHold = await this.repository.findActiveHoldForPayment(existing);
      if (!existingHold) throw new AppError(PAYMENT_MESSAGES.holdExpired, 409, "HOLD_EXPIRED");
      return this.pendingResponse(existing, draftId, existingHold.expiresAt);
    }
    const checkout = await this.repository.findCheckout(draftId, holdTokenHash);
    if (!checkout) throw new NotFoundError(PAYMENT_MESSAGES.holdUnavailable);
    if (checkout.hold.expiresAt && checkout.hold.expiresAt <= new Date()) {
      throw new AppError(PAYMENT_MESSAGES.holdExpired, 409, "HOLD_EXPIRED");
    }
    const pricing = await this.pricingProvider(draftId);
    if (!pricing)
      throw new AppError(PAYMENT_MESSAGES.pricingNotConfigured, 409, "PRICING_NOT_CONFIGURED");
    const paymentCode = `${this.sepayGateway.paymentPrefix}${randomBytes(7).toString("hex").toUpperCase()}`;
    const pending = await this.repository.createPendingPayment({
      draftId,
      holdTokenHash,
      provider: "sepay",
      paymentCode,
      idempotencyKey: input.idempotencyKey,
      pricing,
    });
    if (!pending) throw new AppError(PAYMENT_MESSAGES.holdNoLongerAvailable, 409, "HOLD_EXPIRED");
    return this.pendingResponse(pending.payment, draftId, checkout.hold.expiresAt);
  }

  async handleSepayWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ) {
    if (!this.sepayGateway)
      throw new AppError(PAYMENT_MESSAGES.sepayUnavailable, 503, "PAYMENT_PROVIDER_UNAVAILABLE");
    const event = this.sepayGateway.verifyWebhook(headers, rawBody);
    const existingEvent = await this.repository.findProviderEvent("sepay", event.providerEventId);
    if (existingEvent && existingEvent.status !== "FAILED") return { duplicate: true };
    const recorded =
      existingEvent ??
      (await this.repository.recordProviderEvent({
        provider: "sepay",
        providerEventId: event.providerEventId,
        paymentId: null,
        paymentCode: event.paymentCode,
        amount: event.amount,
        transferType: event.transferType,
        referenceCode: event.referenceCode,
        status: "FAILED",
        payloadMetadata: event.metadata,
      }));
    if (!recorded) return { duplicate: true };
    const payment = await this.repository.findPendingByPaymentCode(event.paymentCode);
    if (!payment || event.transferType !== "in" || event.amount !== Number(payment.totalAmount)) {
      await this.repository.updateProviderEvent(recorded.id, "IGNORED");
      return { duplicate: false, processed: false };
    }
    const hold = await this.repository.findActiveHoldForPayment(payment);
    if (!hold) throw new AppError(PAYMENT_MESSAGES.holdExpired, 409, "HOLD_EXPIRED");
    const completed = await this.repository.completePendingPayment({
      paymentId: payment.id,
      draftId: payment.draftId,
      holdId: hold.id,
      providerPaymentId: event.providerEventId,
      paidAt: new Date(),
    });
    if (!completed)
      throw new AppError(
        PAYMENT_MESSAGES.paymentReceivedPendingReconciliation,
        503,
        "PAYMENT_UNCERTAIN",
      );
    await this.repository.updateProviderEvent(recorded.id, "PROCESSED", payment.id);
    await this.confirmationWithEmail(completed);
    return { duplicate: false, processed: true, paymentId: payment.id };
  }

  async confirmSandboxPayment(paymentId: string): Promise<PaymentResult> {
    const payment = await this.repository.findPayment(paymentId);
    if (!payment) throw new NotFoundError(PAYMENT_MESSAGES.paymentNotFound);

    if (payment.status === "SUCCEEDED") {
      const completed = await this.repository.findCompletedByPaymentId(payment.id);
      return this.completedResult(completed);
    }

    if (payment.status !== "PENDING") {
      throw new AppError(
        PAYMENT_MESSAGES.paymentAttemptFinalized,
        409,
        "PAYMENT_ATTEMPT_FINALIZED",
      );
    }

    const hold = await this.repository.findActiveHoldForPayment(payment);
    if (!hold) throw new AppError(PAYMENT_MESSAGES.holdExpired, 409, "HOLD_EXPIRED");

    const completed = await this.repository.completePendingPayment({
      paymentId: payment.id,
      draftId: payment.draftId,
      holdId: hold.id,
      providerPaymentId: `SANDBOX-${payment.paymentCode}`,
      paidAt: new Date(),
    });

    if (!completed?.booking) {
      throw new AppError(
        PAYMENT_MESSAGES.paymentReceivedPendingReconciliation,
        503,
        "PAYMENT_UNCERTAIN",
      );
    }
    if (!completed.payment.paidAt)
      throw new AppError(PAYMENT_MESSAGES.paymentTimestampMissing, 500);
    if (!completed.booking.bookingCode || !completed.booking.paidAt)
      throw new AppError(PAYMENT_MESSAGES.bookingPaymentInformationMissing, 500);

    return this.completedResult(completed);
  }

  async getStatus(paymentId: string): Promise<PaymentStatusResponse> {
    const payment = await this.repository.findPayment(paymentId);
    if (!payment) throw new NotFoundError(PAYMENT_MESSAGES.paymentNotFound);
    const completed =
      payment.status === "SUCCEEDED"
        ? await this.repository.findCompletedByPaymentId(payment.id)
        : undefined;
    const hold =
      payment.status === "PENDING" ? await this.repository.findActiveHoldForPayment(payment) : null;
    const transferInstructions =
      payment.status === "PENDING" && this.sepayGateway && hold
        ? this.sepayGateway.createInstructions({
            paymentCode: payment.paymentCode,
            amount: payment.totalAmount,
            currency: payment.currency,
            expiresAt: hold.expiresAt ?? new Date(Date.now() + 10 * 60_000),
          })
        : undefined;
    const checkoutSession =
      payment.status === "PENDING" && this.sepayGateway && payment.draftId
        ? this.sepayGateway.createCheckoutSession({
            paymentCode: payment.paymentCode,
            amount: Number(payment.totalAmount),
            currency: payment.currency,
            description: PAYMENT_MESSAGES.checkoutDescription(payment.paymentCode),
            draftId: payment.draftId,
            paymentId: payment.id,
          })
        : null;
    return {
      paymentId: payment.id,
      status: payment.status,
      provider: payment.provider,
      paymentCode: payment.paymentCode,
      transferInstructions,
      checkoutUrl: checkoutSession?.checkoutUrl,
      checkoutFormFields: checkoutSession?.formFields,
      confirmation: completed
        ? {
            ...completed.confirmation,
            emailStatus: (await this.bookingEmail?.getStatus(completed.booking.id)) ?? "FAILED",
          }
        : undefined,
    };
  }
}

function toPaymentResult(
  payment: Pick<Payment, "id" | "provider" | "providerPaymentId" | "currency"> & { paidAt: Date },
  booking: Pick<
    BookingReadRecord,
    | "id"
    | "bookingCode"
    | "facilityId"
    | "unitTypeId"
    | "checkInSlotStart"
    | "rentalEndAt"
    | "requestedMonths"
    | "status"
    | "paidAt"
    | "contactName"
    | "contactEmail"
    | "contactPhone"
    | "rentalFeeAmount"
    | "depositAmount"
    | "totalAmount"
  > & { bookingCode: string; paidAt: Date },
  confirmation?: BookingConfirmation,
): PaymentResult {
  const result: PaidBooking = {
    id: booking.id,
    bookingCode: booking.bookingCode,
    facilityId: booking.facilityId,
    unitTypeId: booking.unitTypeId,
    checkInAt: booking.checkInSlotStart.toISOString(),
    rentalEndAt: booking.rentalEndAt.toISOString(),
    durationMonths: booking.requestedMonths,
    status: "CONFIRMED",
    paidAt: booking.paidAt.toISOString(),
    contact: {
      fullName: booking.contactName,
      email: booking.contactEmail,
      phone: booking.contactPhone,
    },
    pricing: {
      rentalFeeAmount: booking.rentalFeeAmount,
      depositAmount: booking.depositAmount,
      totalAmount: booking.totalAmount,
      currency: payment.currency,
    },
  };
  return {
    id: payment.id,
    status: "SUCCEEDED",
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId,
    paidAt: payment.paidAt.toISOString(),
    pricing: result.pricing,
    booking: result,
    confirmation,
  };
}
