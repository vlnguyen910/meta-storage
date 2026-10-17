import {
  PRICING_MESSAGES,
  PricingQuerySchema,
  PricingUnitTypeParamsSchema,
  UpdateDepositPolicySchema,
  UpdateUnitTypePriceSchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { PricingRepository } from "./pricing.repository";
import { PricingService } from "./pricing.service";

export const pricingRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const service = new PricingService(new PricingRepository(fastify.db));
  const preHandler = [requireRole("BUSINESS_OPERATION_MANAGER")];
  app.get(
    "/pricing",
    { preHandler, schema: { querystring: PricingQuerySchema, tags: ["Pricing"] } },
    async (request, reply) =>
      reply.send(successResponse(await service.getConfiguration(request.query))),
  );
  app.get(
    "/pricing/history",
    { preHandler, schema: { querystring: PricingQuerySchema, tags: ["Pricing"] } },
    async (request, reply) => reply.send(successResponse(await service.history(request.query))),
  );
  app.patch(
    "/pricing",
    { preHandler, schema: { body: UpdateDepositPolicySchema, tags: ["Pricing"] } },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(
          await service.updateDeposit(request.body, request.user.id),
          PRICING_MESSAGES.updated,
        ),
      );
    },
  );
  app.patch(
    "/pricing/:unitTypeId",
    {
      preHandler,
      schema: {
        params: PricingUnitTypeParamsSchema,
        body: UpdateUnitTypePriceSchema,
        tags: ["Pricing"],
      },
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(
          await service.updatePrice(request.params.unitTypeId, request.body, request.user.id),
          PRICING_MESSAGES.updated,
        ),
      );
    },
  );
};
