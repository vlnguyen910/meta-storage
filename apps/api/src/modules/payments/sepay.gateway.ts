import { timingSafeEqual } from "node:crypto";
import { SePayPgClient } from "sepay-pg-node";
import { AppError, BadRequestError, UnauthorizedError } from "../../common/errors/app-error";
import { PAYMENT_MESSAGES } from "./payments.messages";
import type {
  PaymentInstructions,
  SepayCheckoutSession,
  SepayCreateCheckoutInput,
  SepayGatewayConfig,
  SepayOrderDetailResponse,
  SepayWebhookPayload,
  VerifiedPaymentEvent,
} from "./payments.types";

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

  get checkoutConfigured(): boolean {
    return Boolean(this.pgClient);
  }

  async retrievePayment(payment: {
    paymentCode: string;
    totalAmount: string;
    currency: string;
  }): Promise<VerifiedPaymentEvent | null> {
    if (!this.checkoutConfigured) throw new AppError(PAYMENT_MESSAGES.sepayUnavailable, 503);
    // The SDK's order client has no timeout and shares its API host statically.
    // Keep the authenticated, bounded lookup inside this existing provider adapter.
    const host = this.config.env === "production" ? "pgapi.sepay.vn" : "pgapi-sandbox.sepay.vn";
    const signal = AbortSignal.timeout(5000);
    let body: SepayOrderDetailResponse | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(
          `https://${host}/v1/order/detail/${encodeURIComponent(payment.paymentCode)}`,
          {
            headers: {
              Authorization: `Basic ${Buffer.from(`${this.config.merchantId}:${this.config.secretKey}`).toString("base64")}`,
              Accept: "application/json",
              "Cache-Control": "no-store",
            },
            signal,
            redirect: "error",
          },
        );
        // A signed checkout form may not have been submitted to SePay yet.
        if (response.status === 404) return null;
        if (!response.ok)
          throw new AppError(
            PAYMENT_MESSAGES.sepayVerificationUnavailable,
            503,
            `SEPAY_LOOKUP_HTTP_${response.status}`,
          );
        body = (await response.json()) as SepayOrderDetailResponse;
        break;
      } catch (error) {
        if (error instanceof AppError) throw error;
        const code =
          error instanceof Error
            ? ((error.cause as NodeJS.ErrnoException | undefined)?.code ??
              (error as NodeJS.ErrnoException).code)
            : undefined;
        // SePay can reset an idle/new connection. Retrying this read-only GET is
        // safe; share the original deadline so retries never double the timeout.
        const transient =
          code &&
          [
            "ECONNRESET",
            "EPIPE",
            "EAI_AGAIN",
            "ETIMEDOUT",
            "UND_ERR_SOCKET",
            "UND_ERR_CONNECT_TIMEOUT",
          ].includes(code);
        if (attempt === 0 && transient && !signal.aborted) continue;
        // Never expose request headers, credentials or raw provider responses.
        throw new AppError(
          PAYMENT_MESSAGES.sepayVerificationUnavailable,
          503,
          signal.aborted
            ? "SEPAY_LOOKUP_TIMEOUT"
            : transient
              ? "SEPAY_LOOKUP_CONNECTION_FAILED"
              : "SEPAY_LOOKUP_INVALID_RESPONSE",
        );
      }
    }
    const order = body?.data;
    const amount = Number(order?.order_amount);
    if (
      !order ||
      typeof order.order_id !== "string" ||
      !order.order_id.trim() ||
      order.order_id.length > 120 ||
      order.order_invoice_number !== payment.paymentCode ||
      order.order_currency !== payment.currency ||
      order.order_currency !== "VND" ||
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      amount > 2147483647 ||
      amount !== Number(payment.totalAmount)
    )
      throw new AppError(
        PAYMENT_MESSAGES.sepayVerificationUnavailable,
        503,
        "SEPAY_ORDER_MISMATCH",
      );
    if (order.order_status !== "CAPTURED") return null;
    // CAPTURED is SePay's paid order state. Sandbox can return transactions: [].
    // A stable order event makes polling/restarts replay-safe; payment row locking
    // in the reservation payment workflow also deduplicates an optional concurrent IPN.
    return {
      providerEventId: `ORDER:${order.order_id}`,
      referenceCode: order.order_id,
      paymentCode: payment.paymentCode,
      amount,
      currency: order.order_currency,
      transferType: "in",
      successful: true,
      paidAt: parseSePayTimestamp(
        order.transactions?.find(
          (transaction) =>
            transaction.transaction_type === "PAYMENT" &&
            transaction.transaction_status === "APPROVED",
        )?.transaction_date,
      ),
      metadata: {
        source: "order-api",
        orderId: order.order_id,
        invoice: payment.paymentCode,
        status: order.order_status,
        amount,
        currency: order.order_currency,
      },
    };
  }

  createCheckoutSession(input: SepayCreateCheckoutInput): SepayCheckoutSession | null {
    if (!this.pgClient) return null;
    const checkoutUrl = this.pgClient.checkout.initCheckoutUrl();
    const webUrl = this.config.webUrl || "http://localhost:3000";
    const resultUrl = new URL(
      input.reservationId ? "/customer/payments/result" : "/bookings/payment-result",
      webUrl,
    ).toString();
    const reference = `paymentId=${input.paymentId}&${input.reservationId ? `reservationId=${input.reservationId}` : input.renewalId ? `renewalId=${input.renewalId}` : `bookingId=${input.bookingId}`}`;
    const successUrl = `${resultUrl}?status=success&${reference}`;
    const errorUrl = `${resultUrl}?status=error&${reference}`;
    const cancelUrl = `${resultUrl}?status=cancel&${reference}`;

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

    const isSecretKeyValid = Boolean(
      this.config.secretKey &&
        ((receivedSecret && safeEqual(receivedSecret, this.config.secretKey)) ||
          (receivedAuth &&
            (safeEqual(receivedAuth, this.config.secretKey) ||
              safeEqual(receivedAuth, `Bearer ${this.config.secretKey}`)))),
    );

    if (!isSecretKeyValid) {
      throw new UnauthorizedError(PAYMENT_MESSAGES.sepayWebhookUnauthorized);
    }

    let payload: SepayWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as SepayWebhookPayload;
    } catch {
      throw new BadRequestError(PAYMENT_MESSAGES.sepayWebhookInvalidJson);
    }
    if (!payload || typeof payload !== "object")
      throw new BadRequestError(PAYMENT_MESSAGES.sepayWebhookInvalidPayload);

    // SePay PG IPN format
    if (payload.order?.order_invoice_number) {
      const code = payload.order.order_invoice_number;
      const amount = Number(
        payload.transaction?.transaction_amount ?? payload.order.order_amount ?? 0,
      );
      const eventId = String(payload.transaction?.transaction_id ?? "");
      if (
        !eventId ||
        eventId.length > 128 ||
        code.length > 32 ||
        !Number.isSafeInteger(amount) ||
        amount < 0 ||
        amount > 2147483647
      )
        throw new BadRequestError(PAYMENT_MESSAGES.sepayWebhookInvalidPayload);
      return {
        providerEventId: eventId,
        paymentCode: code,
        amount,
        transferType: "in",
        referenceCode: payload.transaction?.transaction_id
          ? String(payload.transaction.transaction_id)
          : null,
        metadata: payload as Record<string, unknown>,
        currency: payload.transaction?.transaction_currency ?? payload.order.order_currency,
        successful:
          payload.notification_type === "ORDER_PAID" &&
          payload.order.order_status === "CAPTURED" &&
          payload.transaction?.transaction_status === "APPROVED" &&
          payload.transaction?.transaction_type === "PAYMENT" &&
          payload.order.order_currency === "VND" &&
          payload.transaction?.transaction_currency === "VND" &&
          Number(payload.order.order_amount) === amount,
        paidAt: parseSePayTimestamp(payload.transaction?.transaction_date),
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

function parseSePayTimestamp(value: unknown): Date | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return;
  const parsed = new Date(`${value.replace(" ", "T")}+07:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
