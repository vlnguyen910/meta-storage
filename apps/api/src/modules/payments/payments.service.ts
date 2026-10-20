import { createHash, randomBytes } from "node:crypto";
import type {
  BookingConfirmation,
  BookingPaymentInput,
  BookingPaymentSession,
  ManualRefund,
  ManualRefundConfirmation,
  ManualRefundQuery,
  PaidBooking,
  PaymentCheckoutInput,
  PaymentResult,
  PaymentStatusResponse,
} from "@metastorage/contracts";
import type { Payment } from "@metastorage/database";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { AppError, NotFoundError, UnauthorizedError } from "../../common/errors/app-error";
import { env } from "../../config/env";
import { type BookingsService, createBookingsService } from "../bookings/bookings.service";
import type { BookingReadRecord } from "../bookings/bookings.types";
import { MockPaymentGateway, type PaymentGateway } from "./payment-mock.gateway";
import { PAYMENT_MESSAGES } from "./payments.messages";
import { PaymentsRepository } from "./payments.repository";
import type { CompletedPayment, PaymentStatusCredentials, PricingSnapshot } from "./payments.types";
import { SepayPaymentGateway } from "./sepay.gateway";

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
    private readonly bookingEmail?: Pick<BookingsService, "enqueueConfirmation" | "getStatus">,
    private readonly logger?: Pick<FastifyBaseLogger, "warn">,
  ) {}

  async listManualRefunds(query: ManualRefundQuery): Promise<ManualRefund[]> {
    const rows = await this.repository.listManualRefunds(query);
    return rows.map((row) => ({ ...row, paidAt: row.paidAt?.toISOString() ?? null }));
  }

  async confirmManualRefund(
    paymentId: string,
    reference: string,
    actorId: string,
  ): Promise<ManualRefundConfirmation> {
    const payment = await this.repository.confirmManualRefund(paymentId, reference, actorId);
    if (!payment.refundReference || !payment.refundedAt || !payment.refundedBy)
      throw new AppError(PAYMENT_MESSAGES.failedToFinalizePayment, 500);
    return {
      paymentId: payment.id,
      status: "REFUNDED",
      amount: payment.refundAmount ?? payment.totalAmount,
      depositForfeitedAmount: payment.depositForfeitedAmount,
      currency: payment.currency,
      reference: payment.refundReference,
      refundedAt: payment.refundedAt.toISOString(),
      refundedBy: payment.refundedBy,
    };
  }

  async startBookingPayment(
    bookingId: string,
    input: BookingPaymentInput,
  ): Promise<BookingPaymentSession> {
    if (!this.sepayGateway?.checkoutConfigured)
      throw new AppError(PAYMENT_MESSAGES.sepayUnavailable, 503, "PAYMENT_PROVIDER_UNAVAILABLE");
    const { payment, expiresAt } = await this.repository.prepareBookingPayment({
      bookingId,
      accessTokenHash: hashToken(input.draftAccessToken),
      contact: input.contact,
      idempotencyKey: input.idempotencyKey,
      paymentCode: `${this.sepayGateway.paymentPrefix}${randomBytes(7).toString("hex").toUpperCase()}`,
      holdDurationMs: 10 * 60_000,
    });
    const session = this.sepayGateway.createCheckoutSession({
      bookingId,
      paymentId: payment.id,
      paymentCode: payment.paymentCode,
      amount: Number(payment.totalAmount),
      currency: payment.currency,
      description: PAYMENT_MESSAGES.checkoutDescription(payment.paymentCode),
    });
    if (!session)
      throw new AppError(PAYMENT_MESSAGES.sepayUnavailable, 503, "PAYMENT_PROVIDER_UNAVAILABLE");
    return {
      bookingId,
      paymentId: payment.id,
      provider: "sepay",
      status: "PENDING",
      paymentCode: payment.paymentCode,
      checkoutUrl: session.checkoutUrl,
      checkoutFormFields: session.formFields,
      expiresAt: expiresAt.toISOString(),
    };
  }

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

  async handleSepayWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ) {
    if (!this.sepayGateway)
      throw new AppError(PAYMENT_MESSAGES.sepayUnavailable, 503, "PAYMENT_PROVIDER_UNAVAILABLE");
    const event = this.sepayGateway.verifyWebhook(headers, rawBody);
    const bookingResult = await this.repository.processBookingPaymentEvent(event);
    if (bookingResult) {
      if (bookingResult.completed) await this.confirmationWithEmail(bookingResult.completed);
      return {
        duplicate: bookingResult.duplicate,
        processed: bookingResult.processed,
        paymentId: bookingResult.paymentId,
      };
    }
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
    if (
      !payment ||
      event.successful === false ||
      event.transferType !== "in" ||
      event.amount !== Number(payment.totalAmount) ||
      (event.currency && event.currency !== payment.currency)
    ) {
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

  private async reconcilePayment(paymentId: string): Promise<void> {
    if (!this.sepayGateway?.checkoutConfigured) return;
    const payment = await this.repository.claimPaymentReconciliation(paymentId);
    if (!payment) return;
    try {
      const event = await this.sepayGateway.retrievePayment(payment);
      if (!event) return;
      const result = await this.repository.processBookingPaymentEvent(event);
      if (result?.completed) await this.confirmationWithEmail(result.completed);
    } catch (error) {
      this.logger?.warn(
        {
          paymentId,
          reason: error instanceof AppError ? error.code : "PAYMENT_RECONCILIATION_FAILED",
        },
        "Payment reconciliation failed; will retry",
      );
      throw error;
    }
  }

  async reconcilePendingPayments(
    facilityId?: string,
  ): Promise<{ checked: number; failed: number }> {
    if (!this.sepayGateway?.checkoutConfigured) return { checked: 0, failed: 0 };
    const pending = await this.repository.listPendingSepayPayments(facilityId);
    const results = await Promise.allSettled(pending.map(({ id }) => this.reconcilePayment(id)));
    return {
      checked: pending.length,
      failed: results.filter((r) => r.status === "rejected").length,
    };
  }

  async getStatus(
    paymentId: string,
    credentials: PaymentStatusCredentials,
  ): Promise<PaymentStatusResponse> {
    if (!credentials.checkoutAccessToken && !credentials.userId)
      throw new UnauthorizedError(PAYMENT_MESSAGES.paymentAccessRequired);
    let payment = await this.repository.findPaymentForStatus(paymentId, {
      userId: credentials.userId,
      tokenHash: credentials.checkoutAccessToken
        ? hashToken(credentials.checkoutAccessToken)
        : undefined,
    });
    if (!payment) throw new NotFoundError(PAYMENT_MESSAGES.paymentNotFound);
    // Authorize before any provider request or state transition. Never use data
    // from the browser return URL to decide whether payment was received.
    if (payment.status === "PENDING") {
      await this.reconcilePayment(payment.id);
      payment = (await this.repository.findPayment(payment.id)) ?? payment;
    }
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
      payment.status === "PENDING" && this.sepayGateway && payment.bookingId && hold
        ? this.sepayGateway.createCheckoutSession({
            paymentCode: payment.paymentCode,
            amount: Number(payment.totalAmount),
            currency: payment.currency,
            description: PAYMENT_MESSAGES.checkoutDescription(payment.paymentCode),
            bookingId: payment.bookingId,
            paymentId: payment.id,
          })
        : null;
    return {
      paymentId: payment.id,
      status: payment.status,
      provider: payment.provider,
      paymentCode: payment.paymentCode,
      transferInstructions,
      refund:
        payment.status === "REFUND_PENDING" || payment.status === "REFUNDED"
          ? {
              amount: payment.refundAmount ?? payment.totalAmount,
              depositForfeitedAmount: payment.depositForfeitedAmount,
              reason: payment.refundReason,
            }
          : undefined,
      checkoutUrl: checkoutSession?.checkoutUrl,
      checkoutFormFields: checkoutSession?.formFields,
      confirmation: completed
        ? {
            ...completed.confirmation,
            emailStatus: (await this.confirmationWithEmail(completed)).emailStatus,
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

export function createPaymentsService(
  fastify: FastifyInstance,
  bookingService?: Pick<BookingsService, "enqueueConfirmation" | "getStatus">,
): PaymentsService {
  const isSepay = env.PAYMENT_PROVIDER === "sepay";
  const hasPgConfig = Boolean(env.SEPAY_MERCHANT_ID && env.SEPAY_SECRET_KEY);
  const hasLegacyConfig = Boolean(
    env.SEPAY_WEBHOOK_API_KEY &&
      env.SEPAY_BANK_NAME &&
      env.SEPAY_BANK_ACCOUNT_NUMBER &&
      env.SEPAY_BANK_ACCOUNT_NAME &&
      env.PUBLIC_API_URL,
  );

  const sepayGateway =
    isSepay && (hasPgConfig || hasLegacyConfig)
      ? new SepayPaymentGateway({
          paymentPrefix: env.SEPAY_PAYMENT_PREFIX,
          env: env.SEPAY_ENV,
          merchantId: env.SEPAY_MERCHANT_ID,
          secretKey: env.SEPAY_SECRET_KEY,
          webUrl: env.WEB_URL,
          apiKey: env.SEPAY_WEBHOOK_API_KEY,
          bankName: env.SEPAY_BANK_NAME,
          accountNumber: env.SEPAY_BANK_ACCOUNT_NUMBER,
          accountName: env.SEPAY_BANK_ACCOUNT_NAME,
          publicApiUrl: env.PUBLIC_API_URL,
        })
      : undefined;
  const repository = new PaymentsRepository(fastify.db);
  return new PaymentsService(
    repository,
    undefined,
    (draftId) => repository.findDraftPricing(draftId),
    sepayGateway,
    bookingService ?? createBookingsService(fastify),
    fastify.log,
  );
}
