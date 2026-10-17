import {
  createFacilityBodySchema,
  facilityIdNestedParamSchema,
  facilityQuerySchema,
  UnitTypeListQuerySchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireAuth, requireRole } from "../auth/auth.guard";
import { FacilityUnitTypesRepository } from "../unit-types/facility-unit-types.repository";
import { FacilityUnitTypesService } from "../unit-types/facility-unit-types.service";
import { requireFacilityAccess } from "./facilities.guard";
import { FacilitiesRepository } from "./facilities.repository";
import { FacilitiesService } from "./facilities.service";
import { FacilityAssignmentsRepository } from "./facility-assignments.repository";
import { FacilityAssignmentsService } from "./facility-assignments.service";

export const facilitiesRoutes: FastifyPluginAsync = async (fastify) => {
  const facilitiesRepository = new FacilitiesRepository(fastify.db);
  const service = new FacilitiesService(facilitiesRepository);
  const assignmentsService = new FacilityAssignmentsService(
    new FacilityAssignmentsRepository(fastify.db),
    facilitiesRepository,
  );
  const unitTypesService = new FacilityUnitTypesService(
    new FacilityUnitTypesRepository(fastify.db),
    facilitiesRepository,
  );

  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

  typedApp.get("/my-assignments", { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.user) throw new UnauthorizedError();
    return reply.send(
      successResponse(
        await assignmentsService.listUserAssignments(request.user.id, request.user.role),
      ),
    );
  });

  // GET /api/facilities/:facilityId/staff - Get active staff in facility
  typedApp.get(
    "/:facilityId/staff",
    {
      schema: {
        params: facilityIdNestedParamSchema,
      },
      preHandler: [
        requireFacilityAccess({
          allowedFacilityRoles: ["FACILITY_MANAGER", "FACILITY_STAFF"],
        }),
      ],
    },
    async (request, reply) => {
      const { facilityId } = request.params;
      const staffList = await assignmentsService.getFacilityStaff(facilityId);
      return reply.status(200).send(successResponse(staffList));
    },
  );

  // POST /api/facilities - Create new facility (Admin & BOM)
  typedApp.post(
    "/",
    {
      schema: {
        body: createFacilityBodySchema,
      },
      preHandler: [requireRole("SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER")],
    },
    async (request, reply) => {
      const facility = await service.createFacility(request.body);
      return reply.status(201).send(successResponse(facility));
    },
  );

  // GET /api/facilities - List facilities
  typedApp.get(
    "/",
    {
      schema: {
        querystring: facilityQuerySchema,
      },
    },
    async (request, reply) => {
      const { limit, offset } = request.query;
      const facilities = await service.getAllActiveFacilities(limit, offset);
      return reply.status(200).send(successResponse(facilities));
    },
  );

  typedApp.get(
    "/:facilityId/unit-types",
    {
      schema: {
        params: facilityIdNestedParamSchema,
        querystring: UnitTypeListQuerySchema,
      },
    },
    async (request, reply) => {
      const unitTypes = await unitTypesService.listByFacility(
        request.params.facilityId,
        request.query,
      );
      return reply.status(200).send(successResponse(unitTypes));
    },
  );
};
