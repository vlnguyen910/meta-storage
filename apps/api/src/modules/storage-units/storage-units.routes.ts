import {
  STORAGE_UNIT_MESSAGES,
  StorageUnitMaintenanceTransitionSchema,
  storageUnitIdParamSchema,
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

  // PATCH /api/storage-units/:id/status - Update storage unit status (Maintenance / Available)
  typedApp.patch(
    "/:id/status",
    {
      schema: {
        params: storageUnitIdParamSchema,
        body: UpdateStorageUnitStatusBodySchema,
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
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const unit = await service.getUnitById(id);
      return reply.status(200).send(successResponse(unit));
    },
  );
};
