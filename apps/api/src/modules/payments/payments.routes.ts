import { PaymentIdParamsSchema } from "@metastorage/contracts";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { successResponse } from "../../common/response/api-response";
import { env } from "../../config/env";

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
