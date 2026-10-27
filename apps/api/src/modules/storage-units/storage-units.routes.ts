import {
  STORAGE_UNIT_MESSAGES,
  StorageUnitListQuerySchema,
  StorageUnitMaintenanceHistoryQuerySchema,
  StorageUnitMaintenanceTransitionSchema,
  storageUnitIdParamSchema,
  UpdateStorageUnitSchema,
  UpdateStorageUnitStatusBodySchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireAuth, requireRole } from "../auth/auth.guard";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { StorageUnitsRepository } from "./storage-units.repository";
import { StorageUnitsService } from "./storage-units.service";

export const storageUnitsRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new StorageUnitsRepository(fastify.db);
  const assignmentsRepository = new FacilityAssignmentsRepository(fastify.db);
  const service = new StorageUnitsService(repository, assignmentsRepository);

  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/",
    {
      schema: {
        tags: ["Storage Units"],
        security: [{ sessionAuth: [] }],
        summary: STORAGE_UNIT_MESSAGES.inventorySummary,
        querystring: StorageUnitListQuerySchema,
      },
      preHandler: [
        requireRole(
          "FACILITY_MANAGER",
          "FACILITY_STAFF",
          "SYSTEM_ADMIN",
          "BUSINESS_OPERATION_MANAGER",
        ),
      ],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      reply.header("Cache-Control", "private, no-store");
      return reply.send(successResponse(await service.listUnits(request.query, request.user)));
    },
  );

  typedApp.patch(
    "/:id",
    {
      schema: {
        params: storageUnitIdParamSchema,
        body: UpdateStorageUnitSchema,
        tags: ["Storage Units"],
        security: [{ sessionAuth: [] }],
        summary: STORAGE_UNIT_MESSAGES.maintenanceTransitionSummary,
      },
      preHandler: [requireAuth, requireRole("FACILITY_MANAGER")],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(
          await service.updateUnit(request.params.id, request.body, request.user),
          STORAGE_UNIT_MESSAGES.unitUpdated,
        ),
      );
    },
  );

  typedApp.get(
    "/:id/maintenance-history",
    {
      schema: {
        params: storageUnitIdParamSchema,
        querystring: StorageUnitMaintenanceHistoryQuerySchema,
        tags: ["Storage Units"],
        security: [{ sessionAuth: [] }],
        summary: STORAGE_UNIT_MESSAGES.maintenanceHistorySummary,
      },
      preHandler: [
        requireAuth,
        requireRole("FACILITY_MANAGER", "SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER"),
      ],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      reply.header("Cache-Control", "private, no-store");
      return reply.send(
        successResponse(
          await service.maintenanceHistory(request.params.id, request.query, request.user),
        ),
      );
    },
  );

  // PATCH /api/storage-units/:id/status - Update storage unit status (Maintenance / Available)
  typedApp.patch(
    "/:id/status",
    {
      schema: {
        params: storageUnitIdParamSchema,
        body: UpdateStorageUnitStatusBodySchema,
        tags: ["Storage Units"],
        security: [{ sessionAuth: [] }],
        summary: STORAGE_UNIT_MESSAGES.maintenanceTransitionSummary,
      },
      preHandler: [
        requireAuth,
        requireRole("FACILITY_MANAGER", "SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER"),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { status, reason } = request.body;

      if (!request.user) throw new UnauthorizedError();

      const unit = await service.transitionStatus(id, status, reason, request.user);
      const message =
        unit.status === "MAINTENANCE"
          ? STORAGE_UNIT_MESSAGES.unitMaintenanceSuccess
          : STORAGE_UNIT_MESSAGES.unitRestoreSuccess;

      return reply.status(200).send(successResponse(unit, message));
    },
  );

  // POST /api/storage-units/:id/transitions - Explicit transition action
  typedApp.post(
    "/:id/transitions",
    {
      schema: {
        params: storageUnitIdParamSchema,
        body: StorageUnitMaintenanceTransitionSchema,
        tags: ["Storage Units"],
        security: [{ sessionAuth: [] }],
        summary: STORAGE_UNIT_MESSAGES.updateSummary,
      },
      preHandler: [
        requireAuth,
        requireRole("FACILITY_MANAGER", "SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER"),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { action, reason } = request.body;

      if (!request.user) throw new UnauthorizedError();

      const targetStatus = action === "ENTER_MAINTENANCE" ? "MAINTENANCE" : "AVAILABLE";
      const unit = await service.transitionStatus(id, targetStatus, reason, request.user);
      const message =
        unit.status === "MAINTENANCE"
          ? STORAGE_UNIT_MESSAGES.unitMaintenanceSuccess
          : STORAGE_UNIT_MESSAGES.unitRestoreSuccess;

      return reply.status(200).send(successResponse(unit, message));
    },
  );

  // GET /api/storage-units/:id - Get unit details
  typedApp.get(
    "/:id",
    {
      schema: {
        params: storageUnitIdParamSchema,
        tags: ["Storage Units"],
        security: [{ sessionAuth: [] }],
        summary: STORAGE_UNIT_MESSAGES.detailSummary,
      },
      preHandler: [
        requireRole(
          "FACILITY_MANAGER",
          "FACILITY_STAFF",
          "SYSTEM_ADMIN",
          "BUSINESS_OPERATION_MANAGER",
        ),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      if (!request.user) throw new UnauthorizedError();
      const unit = await service.getUnitDetails(id, request.user);
      reply.header("Cache-Control", "private, no-store");
      return reply.status(200).send(successResponse(unit));
    },
  );
};
