import {
  PaymentCheckoutInputSchema,
  PaymentDraftParamsSchema,
  PaymentIdParamsSchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { successResponse } from "../../common/response/api-response";
import { env } from "../../config/env";
import { createBookingsService } from "../bookings/bookings.service";
import { PaymentsRepository } from "./payments.repository";
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
    createBookingsService(fastify),
  );
  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/reservations/drafts/:draftId/pay",
    { schema: { params: PaymentDraftParamsSchema, body: PaymentCheckoutInputSchema } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          successResponse(
            env.PAYMENT_PROVIDER === "sepay"
              ? await service.startSepayPayment(request.params.draftId, request.body)
              : await service.pay(request.params.draftId, request.body),
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
    { schema: { params: PaymentIdParamsSchema } },
    async (request, reply) => {
      return reply.send(successResponse(await service.getStatus(request.params.paymentId)));
    },
  );

  // Demo-only shortcut: never expose a client-controlled payment finalizer in production.
  if (env.NODE_ENV !== "production" && env.SEPAY_TEST_MODE) {
    typedApp.post(
      "/payments/:paymentId/confirm-sandbox",
      { schema: { params: PaymentIdParamsSchema } },
      async (request, reply) => {
        return reply.send(
          successResponse(await service.confirmSandboxPayment(request.params.paymentId)),
        );
      },
    );
  }
};
