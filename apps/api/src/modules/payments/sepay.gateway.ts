import { timingSafeEqual } from "node:crypto";
import { SePayPgClient } from "sepay-pg-node";
import { BadRequestError, UnauthorizedError } from "../../common/errors/app-error";
import type { PaymentInstructions, VerifiedPaymentEvent } from "./payment-gateway.types";
import { PAYMENT_MESSAGES } from "./payments.messages";
import type {
  SepayCheckoutSession,
  SepayCreateCheckoutInput,
  SepayGatewayConfig,
  SepayWebhookPayload,
} from "./sepay.types";

export class SepayPaymentGateway {
  readonly provider = "sepay";
  readonly paymentPrefix: string;
  private readonly pgClient?: SePayPgClient;

  constructor(private readonly config: SepayGatewayConfig) {
    this.paymentPrefix = config.paymentPrefix;
    if (config.merchantId && config.secretKey) {
      this.pgClient = new SePayPgClient({
        env: config.env ?? "sandbox",
        merchant_id: config.merchantId,
        secret_key: config.secretKey,
      });
    }
  }

  createCheckoutSession(input: SepayCreateCheckoutInput): SepayCheckoutSession | null {
    if (!this.pgClient) return null;
    const checkoutUrl = this.pgClient.checkout.initCheckoutUrl();
    const webUrl = this.config.webUrl || "http://localhost:3000";
    const successUrl = `${webUrl}/reservations/payment-result?status=success&paymentId=${input.paymentId}&draftId=${input.draftId}`;
    const errorUrl = `${webUrl}/reservations/payment-result?status=error&paymentId=${input.paymentId}&draftId=${input.draftId}`;
    const cancelUrl = `${webUrl}/reservations/payment-result?status=cancel&paymentId=${input.paymentId}&draftId=${input.draftId}`;

    const formFields = this.pgClient.checkout.initOneTimePaymentFields({
      operation: "PURCHASE",
      payment_method: "BANK_TRANSFER",
      order_invoice_number: input.paymentCode,
      order_amount: Math.round(Number(input.amount)),
      currency: input.currency || "VND",
      order_description: input.description,
      success_url: successUrl,
      error_url: errorUrl,
      cancel_url: cancelUrl,
    });

    return {
      checkoutUrl,
      formFields: formFields as Record<string, string | number>,
    };
  }

  createInstructions(input: {
    paymentCode: string;
    amount: string;
    currency: string;
    expiresAt: Date;
  }): PaymentInstructions {
    return {
      paymentCode: input.paymentCode,
      bankName: this.config.bankName ?? "SePay QR",
      accountNumber: this.config.accountNumber ?? "",
      accountName: this.config.accountName ?? "metastorage",
      amount: input.amount,
      currency: input.currency,
      content: input.paymentCode,
      expiresAt: input.expiresAt.toISOString(),
    };
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): VerifiedPaymentEvent {
    const secretKeyHeader = headers["x-secret-key"] ?? headers["X-Secret-Key"];
    const receivedSecret = Array.isArray(secretKeyHeader) ? secretKeyHeader[0] : secretKeyHeader;
    const authorization = headers.authorization ?? headers.Authorization;
    const receivedAuth = Array.isArray(authorization) ? authorization[0] : authorization;

    const isApiKeyValid = Boolean(
      this.config.apiKey && receivedAuth && safeEqual(receivedAuth, `Apikey ${this.config.apiKey}`),
    );
    const isSecretKeyValid = Boolean(
      this.config.secretKey &&
        ((receivedSecret && safeEqual(receivedSecret, this.config.secretKey)) ||
          (receivedAuth &&
            (safeEqual(receivedAuth, this.config.secretKey) ||
              safeEqual(receivedAuth, `Bearer ${this.config.secretKey}`)))),
    );

    if (!isApiKeyValid && !isSecretKeyValid) {
      throw new UnauthorizedError(PAYMENT_MESSAGES.sepayWebhookUnauthorized);
    }

    let payload: SepayWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as SepayWebhookPayload;
    } catch {
      throw new BadRequestError(PAYMENT_MESSAGES.sepayWebhookInvalidJson);
    }

    // SePay PG IPN format
    if (payload.order?.order_invoice_number) {
      const code = payload.order.order_invoice_number;
      const amount = Number(
        payload.transaction?.transaction_amount ?? payload.order.order_amount ?? 0,
      );
      const eventId = String(payload.transaction?.transaction_id ?? `IPN-${code}-${Date.now()}`);
      return {
        providerEventId: eventId,
        paymentCode: code,
        amount,
        transferType: "in",
        referenceCode: payload.transaction?.transaction_id
          ? String(payload.transaction.transaction_id)
          : null,
        metadata: payload as Record<string, unknown>,
      };
    }

    // Legacy Bank Webhook format
    if (payload.id && payload.code && typeof payload.transferAmount === "number") {
      return {
        providerEventId: String(payload.id),
        paymentCode: payload.code,
        amount: payload.transferAmount,
        transferType: payload.transferType ?? "in",
        referenceCode: payload.referenceCode ?? null,
        metadata: {
          id: payload.id,
          code: payload.code,
          transferType: payload.transferType,
          transferAmount: payload.transferAmount,
          referenceCode: payload.referenceCode ?? null,
        },
      };
    }

    // Ping test from SePay dashboard ("Gửi test")
    if (payload.notification_type === "TEST" || payload.is_test) {
      return {
        providerEventId: `TEST-${Date.now()}`,
        paymentCode: "TEST",
        amount: 0,
        transferType: "in",
        referenceCode: "TEST",
        metadata: payload as Record<string, unknown>,
      };
    }

    throw new BadRequestError(PAYMENT_MESSAGES.sepayWebhookInvalidPayload);
  }
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
