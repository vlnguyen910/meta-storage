import type {
  ManualRefund,
  ManualRefundConfirmation,
  ManualRefundQuery,
  PaymentStatusResponse,
} from "@metastorage/contracts";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { AppError, NotFoundError, UnauthorizedError } from "../../common/errors/app-error";
import { env } from "../../config/env";
import { PAYMENT_MESSAGES } from "./payments.messages";
import { PaymentsRepository } from "./payments.repository";
import type { PaymentStatusCredentials } from "./payments.types";
import {
  createReservationPaymentsService,
  type ReservationPaymentsService,
} from "./reservation-payments.service";
import { SepayPaymentGateway } from "./sepay.gateway";

function requirePaymentCode(code: string | null): string {
  if (!code) throw new AppError(PAYMENT_MESSAGES.paymentCodeMissing, 500);
  return code;
}

export class PaymentsService {
  constructor(
    private readonly repository: PaymentsRepository,
    private readonly sepayGateway?: SepayPaymentGateway,
    private readonly logger?: Pick<FastifyBaseLogger, "warn">,
    private readonly reservationPayments?: ReservationPaymentsService,
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

  async handleSepayWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ) {
    if (!this.sepayGateway)
      throw new AppError(PAYMENT_MESSAGES.sepayUnavailable, 503, "PAYMENT_PROVIDER_UNAVAILABLE");
    const event = this.sepayGateway.verifyWebhook(headers, rawBody);
    const reservationResult = await this.reservationPayments?.processEvent(event);
    if (reservationResult) return reservationResult;
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
    await this.repository.updateProviderEvent(recorded.id, "IGNORED");
    return { duplicate: false, processed: false };
  }

  private async reconcilePayment(paymentId: string): Promise<void> {
    if (!this.sepayGateway?.checkoutConfigured) return;
    const payment = await this.repository.claimPaymentReconciliation(paymentId);
    if (!payment) return;
    try {
      const event = await this.sepayGateway.retrievePayment({
        ...payment,
        paymentCode: requirePaymentCode(payment.paymentCode),
      });
      if (!event) return;
      await this.reservationPayments?.processEvent(event);
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
    if (!credentials.userId) throw new UnauthorizedError(PAYMENT_MESSAGES.paymentAccessRequired);
    let payment = await this.repository.findPaymentForStatus(paymentId, {
      userId: credentials.userId,
    });
    if (!payment) throw new NotFoundError(PAYMENT_MESSAGES.paymentNotFound);
    // Authorize before any provider request or state transition. Never use data
    // from the browser return URL to decide whether payment was received.
    if (payment.status === "PENDING") {
      requirePaymentCode(payment.paymentCode);
      await this.reconcilePayment(payment.id);
      payment = (await this.repository.findPayment(payment.id)) ?? payment;
    }
    if (payment.status === "PENDING") requirePaymentCode(payment.paymentCode);
    const hold =
      payment.status === "PENDING" ? await this.repository.findActiveHoldForPayment(payment) : null;
    const transferInstructions =
      payment.status === "PENDING" && this.sepayGateway && hold
        ? this.sepayGateway.createInstructions({
            paymentCode: requirePaymentCode(payment.paymentCode),
            amount: payment.totalAmount,
            currency: payment.currency,
            expiresAt: hold?.expiresAt ?? payment.expiresAt ?? new Date(Date.now() + 10 * 60_000),
          })
        : undefined;
    const checkoutSession =
      payment.status === "PENDING" &&
      this.sepayGateway &&
      (payment.bookingId || payment.reservationId) &&
      hold
        ? this.sepayGateway.createCheckoutSession({
            paymentCode: requirePaymentCode(payment.paymentCode),
            amount: Number(payment.totalAmount),
            currency: payment.currency,
            description: PAYMENT_MESSAGES.checkoutDescription(
              requirePaymentCode(payment.paymentCode),
            ),
            bookingId: payment.bookingId ?? undefined,
            reservationId: payment.reservationId ?? undefined,
            paymentId: payment.id,
          })
        : null;
    return {
      paymentId: payment.id,
      ...(payment.reservationId ? { reservationId: payment.reservationId } : {}),
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
    };
  }
}

export function createSepayGateway() {
  const isSepay = env.PAYMENT_PROVIDER === "sepay";
  const hasPgConfig = Boolean(env.SEPAY_MERCHANT_ID && env.SEPAY_SECRET_KEY);

  return isSepay && hasPgConfig
    ? new SepayPaymentGateway({
        paymentPrefix: env.SEPAY_PAYMENT_PREFIX,
        env: env.SEPAY_ENV,
        merchantId: env.SEPAY_MERCHANT_ID,
        secretKey: env.SEPAY_SECRET_KEY,
        webUrl: env.WEB_URL,
        bankName: env.SEPAY_BANK_NAME,
        accountNumber: env.SEPAY_BANK_ACCOUNT_NUMBER,
        accountName: env.SEPAY_BANK_ACCOUNT_NAME,
      })
    : undefined;
}

export function createPaymentsService(fastify: FastifyInstance): PaymentsService {
  const sepayGateway = createSepayGateway();
  const repository = new PaymentsRepository(fastify.db);
  return new PaymentsService(
    repository,
    sepayGateway,
    fastify.log,
    createReservationPaymentsService(fastify.db, sepayGateway),
  );
}
