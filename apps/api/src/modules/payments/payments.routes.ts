import {
  ConfirmManualRefundInputSchema,
  ManualRefundQuerySchema,
  PaymentIdParamsSchema,
  PaymentStatusHeadersSchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { env } from "../../config/env";
import { optionalAuth, requireRole } from "../auth/auth.guard";
import { AUTH_MESSAGES } from "../auth/auth.messages";
import { privateTrackingResponse } from "../bookings/bookings.access";
import { createPaymentsService } from "./payments.service";

export const paymentsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = createPaymentsService(fastify);
  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

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
    "/payments/refunds",
    {
      preHandler: [requireRole("SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER")],
      schema: { querystring: ManualRefundQuerySchema },
    },
    async (request, reply) =>
      reply.send(successResponse(await service.listManualRefunds(request.query))),
  );

  typedApp.post(
    "/payments/:paymentId/refund/confirm",
    {
      preHandler: [requireRole("SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER")],
      schema: { params: PaymentIdParamsSchema, body: ConfirmManualRefundInputSchema },
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError(AUTH_MESSAGES.loginRequired);
      return reply.send(
        successResponse(
          await service.confirmManualRefund(
            request.params.paymentId,
            request.body.reference,
            request.user.id,
          ),
        ),
      );
    },
  );

  typedApp.get(
    "/payments/:paymentId/status",
    {
      onRequest: [privateTrackingResponse],
      preHandler: [optionalAuth],
      schema: { params: PaymentIdParamsSchema, headers: PaymentStatusHeadersSchema },
    },
    async (request, reply) => {
      return reply.send(
        successResponse(
          await service.getStatus(request.params.paymentId, {
            checkoutAccessToken: request.headers["x-booking-access-token"],
            userId: request.user?.id,
          }),
        ),
      );
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
