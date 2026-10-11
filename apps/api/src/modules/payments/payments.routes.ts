import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { successResponse } from "../../common/response/api-response";
import { env } from "../../config/env";
import { BookingEmailService } from "../bookings/booking-email.service";
import { PaymentsRepository } from "./payments.repository";
import {
  type CheckoutPaymentBody,
  checkoutPaymentBodySchema,
  paymentDraftIdParamSchema,
  paymentIdParamSchema,
} from "./payments.schema";
import { PaymentsService } from "./payments.service";
import { SepayPaymentGateway } from "./sepay.gateway";

export const paymentsRoutes: FastifyPluginAsync = async (fastify) => {
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
  const service = new PaymentsService(
    repository,
    undefined,
    (draftId) => repository.findDraftPricing(draftId),
    sepayGateway,
    new BookingEmailService(fastify.redis, fastify.mailQueue, {
      publicAppUrl: process.env.PUBLIC_APP_URL ?? "http://localhost:3000",
      magicLinkSecret: process.env.BOOKING_MAGIC_LINK_SECRET ?? "",
      qrTokenSecret: process.env.QR_TOKEN_SECRET ?? "storex-dev-qr-secret",
      onEnqueueFailure: (bookingId) =>
        fastify.log.error({ bookingId }, "Booking mail enqueue failed"),
    }),
  );
  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/reservations/drafts/:draftId/pay",
    { schema: { params: paymentDraftIdParamSchema, body: checkoutPaymentBodySchema } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          successResponse(
            env.PAYMENT_PROVIDER === "sepay"
              ? await service.startSepayPayment(
                  request.params.draftId,
                  request.body as CheckoutPaymentBody,
                )
              : await service.pay(request.params.draftId, request.body as CheckoutPaymentBody),
          ),
        ),
  );

  const handleWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    await service.handleSepayWebhook(
      request.headers as Record<string, string | string[] | undefined>,
      JSON.stringify(request.body ?? {}),
    );
    return reply.status(200).send({ success: true });
  };

  typedApp.post("/payments/webhooks/sepay", handleWebhook);
  typedApp.post("/sepay/ipn", handleWebhook);

  typedApp.get(
    "/payments/:paymentId/status",
    { schema: { params: paymentIdParamSchema } },
    async (request, reply) => {
      return reply.send(successResponse(await service.getStatus(request.params.paymentId)));
    },
  );

  // Demo-only shortcut: never expose a client-controlled payment finalizer in production.
  if (env.NODE_ENV !== "production" && env.SEPAY_TEST_MODE) {
    typedApp.post(
      "/payments/:paymentId/confirm-sandbox",
      { schema: { params: paymentIdParamSchema } },
      async (request, reply) => {
        return reply.send(
          successResponse(await service.confirmSandboxPayment(request.params.paymentId)),
        );
      },
    );
  }
};
