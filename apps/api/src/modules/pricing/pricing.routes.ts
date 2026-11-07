import {
  CreatePriceRangeSchema,
  PRICING_MESSAGES,
  PriceRangeIdParamsSchema,
  PricingQuerySchema,
  PricingUnitTypeParamsSchema,
  SetUnitTypePriceRangeSchema,
  UpdateDepositPolicySchema,
  UpdatePriceRangeSchema,
  UpdateUnitTypePriceSchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { UnitTypesRepository } from "../unit-types/unit-types.repository";
import { UnitTypesService } from "../unit-types/unit-types.service";
import { PricingRepository } from "./pricing.repository";
import { PricingService } from "./pricing.service";

export const pricingRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const service = new PricingService(new PricingRepository(fastify.db));
  const catalog = new UnitTypesService(new UnitTypesRepository(fastify.db));
  const preHandler = [requireRole("BUSINESS_OPERATION_MANAGER")];
  app.get(
    "/pricing/ranges",
    {
      preHandler: [requireRole("BUSINESS_OPERATION_MANAGER", "FACILITY_MANAGER")],
      schema: { querystring: PricingQuerySchema, tags: ["Pricing"] },
    },
    async (request, reply) =>
      reply.send(successResponse(await service.listPriceRanges(request.query))),
  );
  app.post(
    "/pricing/ranges",
    { preHandler, schema: { body: CreatePriceRangeSchema, tags: ["Pricing"] } },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply
        .status(201)
        .send(
          successResponse(
            await service.createPriceRange(request.body, request.user.id),
            PRICING_MESSAGES.rangeCreated,
          ),
        );
    },
  );
  app.patch(
    "/pricing/ranges/:id",
    {
      preHandler,
      schema: {
        params: PriceRangeIdParamsSchema,
        body: UpdatePriceRangeSchema,
        tags: ["Pricing"],
      },
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(
          await service.updatePriceRange(request.params.id, request.body, request.user.id),
          PRICING_MESSAGES.rangeUpdated,
        ),
      );
    },
  );
  app.patch(
    "/pricing/unit-types/:unitTypeId/price-range",
    {
      preHandler: [requireRole("FACILITY_MANAGER")],
      schema: {
        params: PricingUnitTypeParamsSchema,
        body: SetUnitTypePriceRangeSchema,
        tags: ["Pricing"],
      },
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(
          await catalog.setPriceRange(request.params.unitTypeId, request.body, request.user),
          PRICING_MESSAGES.rangeAssigned,
        ),
      );
    },
  );
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
      preHandler: [requireRole("FACILITY_MANAGER")],
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
          {
            version: (await catalog.update(request.params.unitTypeId, request.body, request.user))
              .version,
          },
          PRICING_MESSAGES.updated,
        ),
      );
    },
  );
};
