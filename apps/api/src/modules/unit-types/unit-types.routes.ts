import {
  CreateUnitTypeSchema,
  UnitTypeIdParamsSchema,
  UnitTypeManagementQuerySchema,
  UpdateUnitTypeSchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { UNIT_TYPE_MESSAGES } from "./unit-types.messages";
import { UnitTypesRepository } from "./unit-types.repository";
import { UnitTypesService } from "./unit-types.service";

export const unitTypesRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new UnitTypesService(new UnitTypesRepository(fastify.db));
  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/",
    {
      schema: {
        tags: ["Unit Types"],
        security: [{ sessionAuth: [] }],
        summary: UNIT_TYPE_MESSAGES.unitTypeListSummary,
        querystring: UnitTypeManagementQuerySchema,
      },
      preHandler: [requireRole("SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER")],
    },
    async (request, reply) => reply.send(successResponse(await service.list(request.query))),
  );

  typedApp.post(
    "/",
    {
      schema: {
        tags: ["Unit Types"],
        security: [{ sessionAuth: [] }],
        summary: UNIT_TYPE_MESSAGES.unitTypeCreateSummary,
        body: CreateUnitTypeSchema,
      },
      preHandler: [requireRole("SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER")],
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          successResponse(await service.create(request.body), UNIT_TYPE_MESSAGES.unitTypeCreated),
        ),
  );

  typedApp.patch(
    "/:id",
    {
      schema: {
        tags: ["Unit Types"],
        security: [{ sessionAuth: [] }],
        summary: UNIT_TYPE_MESSAGES.unitTypeUpdateSummary,
        params: UnitTypeIdParamsSchema,
        body: UpdateUnitTypeSchema,
      },
      preHandler: [requireRole("SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER")],
    },
    async (request, reply) =>
      reply
        .status(200)
        .send(
          successResponse(
            await service.update(request.params.id, request.body),
            UNIT_TYPE_MESSAGES.unitTypeUpdated,
          ),
        ),
  );
};
