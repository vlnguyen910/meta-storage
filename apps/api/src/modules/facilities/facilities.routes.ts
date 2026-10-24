import type { ApiFacility, ApiFacilityAssignment } from "@metastorage/contracts";
import {
  ConfigureReturnCalendarSchema,
  CreateStorageUnitSchema,
  createAssignmentBodySchema,
  createFacilityBodySchema,
  FacilityRentalChargeParamsSchema,
  FacilityRentalChargeQuerySchema,
  FacilityRentalHistoryQuerySchema,
  FacilityRentalListParamsSchema,
  FacilityRentalListQuerySchema,
  FacilityRentalParamsSchema,
  facilityAssignmentListQuerySchema,
  facilityAssignmentParamSchema,
  facilityIdNestedParamSchema,
  facilityManagementQuerySchema,
  facilityQuerySchema,
  facilityStorageUnitParamsSchema,
  facilityUnitTypeParamsSchema,
  ReturnFacilityParamsSchema,
  ReturnQueueEnvelopeSchema,
  ReturnQueueQuerySchema,
  SetFacilityUnitTypeSchema,
  STORAGE_UNIT_MESSAGES,
  UnitTypeListQuerySchema,
  updateFacilityBodySchema,
  updateFacilityIdParamSchema,
} from "@metastorage/contracts";
import type { Facility, FacilityAssignment } from "@metastorage/database";
import type { FastifyPluginAsync, onRequestAsyncHookHandler } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireAuth, requireRole } from "../auth/auth.guard";
import { RentalChargesRepository } from "../rental-charges/rental-charges.repository";
import { RentalChargesService } from "../rental-charges/rental-charges.service";
import { RentalsRepository } from "../rentals/rentals.repository";
import { RentalsService } from "../rentals/rentals.service";
import { ReturnsRepository } from "../returns/returns.repository";
import { ReturnsService } from "../returns/returns.service";
import { StorageUnitsRepository } from "../storage-units/storage-units.repository";
import { StorageUnitsService } from "../storage-units/storage-units.service";
import { FacilityUnitTypesRepository } from "../unit-types/facility-unit-types.repository";
import { FacilityUnitTypesService } from "../unit-types/facility-unit-types.service";
import { UnitTypesRepository } from "../unit-types/unit-types.repository";
import { UnitTypesService } from "../unit-types/unit-types.service";
import { getFacilityAccessScope } from "./facilities.access";
import { requireFacilityAccess } from "./facilities.guard";
import { FACILITY_MESSAGES } from "./facilities.messages";
import { FacilitiesRepository } from "./facilities.repository";
import { FacilitiesService } from "./facilities.service";
import { FacilityAssignmentsRepository } from "./facility-assignments.repository";
import { FacilityAssignmentsService } from "./facility-assignments.service";

export const facilitiesRoutes: FastifyPluginAsync = async (fastify) => {
  const rentalsService = new RentalsService(new RentalsRepository(fastify.db));
  const chargesService = new RentalChargesService(new RentalChargesRepository(fastify.db));
  const facilitiesRepository = new FacilitiesRepository(fastify.db);
  const catalogService = new UnitTypesService(new UnitTypesRepository(fastify.db));
  const service = new FacilitiesService(facilitiesRepository);
  const assignmentsService = new FacilityAssignmentsService(
    new FacilityAssignmentsRepository(fastify.db),
    facilitiesRepository,
  );
  const unitTypesService = new FacilityUnitTypesService(
    new FacilityUnitTypesRepository(fastify.db),
    facilitiesRepository,
  );
  const storageUnitsService = new StorageUnitsService(
    new StorageUnitsRepository(fastify.db),
    new FacilityAssignmentsRepository(fastify.db),
  );
  const returnsService = new ReturnsService(new ReturnsRepository(fastify.db));
  const privateReturnResponse: onRequestAsyncHookHandler = async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
  };

  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/:facilityId/rentals",
    {
      onRequest: privateReturnResponse,
      preHandler: [requireRole("FACILITY_MANAGER")],
      schema: {
        tags: ["Rentals"],
        params: FacilityRentalListParamsSchema,
        querystring: FacilityRentalListQuerySchema,
      },
    },
    async (request) => {
      if (!request.user) throw new UnauthorizedError();
      return successResponse(
        await rentalsService.facilityList(request.user, request.params.facilityId, request.query),
      );
    },
  );
  typedApp.get(
    "/:facilityId/rentals/:rentalId",
    {
      onRequest: privateReturnResponse,
      preHandler: [requireRole("FACILITY_MANAGER")],
      schema: { tags: ["Rentals"], params: FacilityRentalParamsSchema },
    },
    async (request) => {
      if (!request.user) throw new UnauthorizedError();
      return successResponse(
        await rentalsService.facilityDetail(
          request.user,
          request.params.facilityId,
          request.params.rentalId,
        ),
      );
    },
  );
  typedApp.get(
    "/:facilityId/rentals/:rentalId/payments",
    {
      onRequest: privateReturnResponse,
      preHandler: [requireRole("FACILITY_MANAGER")],
      schema: {
        tags: ["Rentals"],
        params: FacilityRentalParamsSchema,
        querystring: FacilityRentalHistoryQuerySchema,
      },
    },
    async (request) => {
      if (!request.user) throw new UnauthorizedError();
      return successResponse(
        await rentalsService.facilityPayments(
          request.user,
          request.params.facilityId,
          request.params.rentalId,
          request.query,
        ),
      );
    },
  );
  typedApp.get(
    "/:facilityId/rentals/:rentalId/renewals",
    {
      onRequest: privateReturnResponse,
      preHandler: [requireRole("FACILITY_MANAGER")],
      schema: {
        tags: ["Renewals"],
        params: FacilityRentalParamsSchema,
        querystring: FacilityRentalHistoryQuerySchema,
      },
    },
    async (request) => {
      if (!request.user) throw new UnauthorizedError();
      return successResponse(
        await rentalsService.facilityRenewals(
          request.user,
          request.params.facilityId,
          request.params.rentalId,
          request.query,
        ),
      );
    },
  );
  typedApp.get(
    "/:facilityId/rental-charges",
    {
      onRequest: privateReturnResponse,
      preHandler: [requireRole("FACILITY_MANAGER")],
      schema: {
        tags: ["Rental Charges"],
        params: FacilityRentalChargeParamsSchema,
        querystring: FacilityRentalChargeQuerySchema,
      },
    },
    async (request) => {
      if (!request.user?.role) throw new UnauthorizedError();
      return successResponse(
        await chargesService.facilityQueue(
          { id: request.user.id, role: request.user.role },
          request.params.facilityId,
          request.query,
        ),
      );
    },
  );

  typedApp.get(
    "/:facilityId/return-requests",
    {
      onRequest: privateReturnResponse,
      preHandler: [requireAuth],
      schema: {
        params: ReturnFacilityParamsSchema,
        querystring: ReturnQueueQuerySchema,
        response: { 200: ReturnQueueEnvelopeSchema },
      },
    },
    async (request) => {
      if (!request.user) throw new UnauthorizedError();
      return successResponse(
        await returnsService.queue(request.user, request.params.facilityId, request.query),
      );
    },
  );

  typedApp.get(
    "/:facilityId/return-calendar",
    {
      onRequest: privateReturnResponse,
      preHandler: [requireRole("SYSTEM_ADMIN")],
      schema: { params: ReturnFacilityParamsSchema },
    },
    async (request) => {
      if (!request.user) throw new UnauthorizedError();
      return successResponse(
        await returnsService.calendar(request.user, request.params.facilityId),
      );
    },
  );

  typedApp.put(
    "/:facilityId/return-calendar",
    {
      onRequest: privateReturnResponse,
      preHandler: [requireRole("SYSTEM_ADMIN")],
      schema: { params: ReturnFacilityParamsSchema, body: ConfigureReturnCalendarSchema },
    },
    async (request) => {
      if (!request.user) throw new UnauthorizedError();
      return successResponse(
        await returnsService.configureCalendar(
          request.user,
          request.params.facilityId,
          request.body,
        ),
      );
    },
  );

  typedApp.get(
    "/management",
    {
      schema: {
        tags: ["Facilities"],
        security: [{ sessionAuth: [] }],
        summary: FACILITY_MESSAGES.managementSummary,
        querystring: facilityManagementQuerySchema,
      },
      preHandler: [requireRole("SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER")],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      const scope = getFacilityAccessScope(request.user);
      const facilities = await service.listFacilities(
        request.query.limit,
        request.query.offset,
        request.query.isActive,
        scope,
      );
      return reply.send(successResponse(facilities.map(toApiFacility)));
    },
  );

  typedApp.get(
    "/:facilityId",
    {
      schema: {
        tags: ["Facilities"],
        security: [{ sessionAuth: [] }],
        summary: FACILITY_MESSAGES.detailSummary,
        params: facilityIdNestedParamSchema,
      },
      preHandler: [
        requireAuth,
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
      const facility = await service.getFacilityById(
        request.params.facilityId,
        getFacilityAccessScope(request.user),
      );
      return reply.send(successResponse(toApiFacility(facility)));
    },
  );

  typedApp.patch(
    "/:facilityId",
    {
      schema: {
        tags: ["Facilities"],
        security: [{ sessionAuth: [] }],
        summary: FACILITY_MESSAGES.updateSummary,
        params: updateFacilityIdParamSchema,
        body: updateFacilityBodySchema,
      },
      preHandler: [requireRole("SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER")],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      const facility = await service.updateFacility(
        request.params.facilityId,
        request.body,
        getFacilityAccessScope(request.user),
      );
      return reply.send(
        successResponse(toApiFacility(facility), FACILITY_MESSAGES.facilityMetadataUpdated),
      );
    },
  );

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
        tags: ["Facilities"],
        security: [{ sessionAuth: [] }],
        summary: FACILITY_MESSAGES.assignmentsSummary,
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

  typedApp.get(
    "/:facilityId/assignments",
    {
      schema: {
        params: facilityIdNestedParamSchema,
        querystring: facilityAssignmentListQuerySchema,
      },
      preHandler: [requireRole("SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER")],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      const assignments = await assignmentsService.listFacilityAssignments(
        request.params.facilityId,
        request.query.limit,
        request.query.offset,
        getFacilityAccessScope(request.user),
      );
      return reply.send(successResponse(assignments.map(toApiAssignment)));
    },
  );

  typedApp.post(
    "/:facilityId/assignments",
    {
      schema: {
        tags: ["Facilities"],
        security: [{ sessionAuth: [] }],
        summary: FACILITY_MESSAGES.assignmentsSummary,
        params: facilityIdNestedParamSchema,
        body: createAssignmentBodySchema,
      },
      preHandler: [requireRole("SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER")],
    },
    async (request, reply) => {
      const assignment = await assignmentsService.assignUser(
        request.params.facilityId,
        request.body.userId,
        request.body.role,
      );
      return reply
        .status(201)
        .send(successResponse(toApiAssignment(assignment), FACILITY_MESSAGES.assignmentCreated));
    },
  );

  typedApp.delete(
    "/:facilityId/assignments/:userId",
    {
      schema: {
        tags: ["Facilities"],
        security: [{ sessionAuth: [] }],
        summary: FACILITY_MESSAGES.assignmentsSummary,
        params: facilityAssignmentParamSchema,
      },
      preHandler: [requireRole("SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER")],
    },
    async (request, reply) => {
      const assignment = await assignmentsService.revokeAssignment(
        request.params.facilityId,
        request.params.userId,
      );
      return reply.send(
        successResponse(toApiAssignment(assignment), FACILITY_MESSAGES.assignmentRevoked),
      );
    },
  );

  // POST /api/facilities - Create new facility (Admin & BOM)
  typedApp.post(
    "/",
    {
      schema: {
        tags: ["Facilities"],
        security: [{ sessionAuth: [] }],
        summary: FACILITY_MESSAGES.managementSummary,
        body: createFacilityBodySchema,
      },
      preHandler: [requireRole("SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER")],
    },
    async (request, reply) => {
      const facility = await service.createFacility(request.body);
      return reply
        .status(201)
        .send(successResponse(toApiFacility(facility), FACILITY_MESSAGES.facilityCreated));
    },
  );

  typedApp.get(
    "/:facilityId/unit-types/management",
    {
      schema: {
        tags: ["Facilities"],
        security: [{ sessionAuth: [] }],
        summary: FACILITY_MESSAGES.facilityUnitTypesSummary,
        params: facilityIdNestedParamSchema,
        querystring: facilityManagementQuerySchema,
      },
      preHandler: [requireRole("SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER", "FACILITY_MANAGER")],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      reply.header("Cache-Control", "private, no-store");
      const items = await catalogService.list(
        { ...request.query, facilityId: request.params.facilityId },
        request.user,
      );
      return reply.send(successResponse(items));
    },
  );

  typedApp.patch(
    "/:facilityId/unit-types/:unitTypeId",
    {
      schema: {
        tags: ["Facilities"],
        security: [{ sessionAuth: [] }],
        summary: FACILITY_MESSAGES.facilityUnitTypeUpdateSummary,
        params: facilityUnitTypeParamsSchema,
        body: SetFacilityUnitTypeSchema,
      },
      preHandler: [requireRole("FACILITY_MANAGER")],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      const offering = await catalogService.update(
        request.params.unitTypeId,
        request.body,
        request.user,
        request.params.facilityId,
      );
      return reply.send(successResponse(offering));
    },
  );

  typedApp.post(
    "/:facilityId/storage-units",
    {
      schema: {
        tags: ["Storage Units"],
        security: [{ sessionAuth: [] }],
        summary: STORAGE_UNIT_MESSAGES.createSummary,
        params: facilityStorageUnitParamsSchema,
        body: CreateStorageUnitSchema,
      },
      preHandler: [requireAuth, requireRole("FACILITY_MANAGER")],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      const unit = await storageUnitsService.createUnit(
        request.params.facilityId,
        request.body,
        request.user,
      );
      return reply.status(201).send(successResponse(unit, STORAGE_UNIT_MESSAGES.unitCreated));
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

function toApiFacility(facility: Facility): ApiFacility {
  return {
    id: facility.id,
    code: facility.code,
    name: facility.name,
    address: facility.address,
    description: facility.description,
    isActive: facility.isActive,
    createdAt: facility.createdAt.toISOString(),
    updatedAt: facility.updatedAt.toISOString(),
  };
}

function toApiAssignment(
  assignment: FacilityAssignment & {
    userName?: string;
    userEmail?: string;
    facilityName?: string;
    facilityCode?: string;
  },
): ApiFacilityAssignment {
  return {
    id: assignment.id,
    userId: assignment.userId,
    facilityId: assignment.facilityId,
    assignedAt: assignment.assignedAt.toISOString(),
    endedAt: assignment.endedAt?.toISOString() ?? null,
    isActive: assignment.isActive,
    role: assignment.role as ApiFacilityAssignment["role"],
    ...(assignment.userName ? { userName: assignment.userName } : {}),
    ...(assignment.userEmail ? { userEmail: assignment.userEmail } : {}),
    ...(assignment.facilityName ? { facilityName: assignment.facilityName } : {}),
    ...(assignment.facilityCode ? { facilityCode: assignment.facilityCode } : {}),
  };
}
