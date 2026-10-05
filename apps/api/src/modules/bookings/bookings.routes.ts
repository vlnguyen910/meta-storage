import {
  AssignPhysicalUnitBodySchema,
  AssignStaffBodySchema,
  BookingDraftInputSchema,
  BookingIdParamsSchema,
  BookingListQuerySchema,
  FacilityBookingsParamsSchema,
  StaffTasksQuerySchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { optionalAuth, requireAuth, requireRole } from "../auth/auth.guard";
import { getFacilityAccessScope, requireAssignedFacility } from "../facilities/facilities.access";
import { requireFacilityAccess } from "../facilities/facilities.guard";
import { FacilitiesRepository } from "../facilities/facilities.repository";
import { FacilitiesService } from "../facilities/facilities.service";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { StorageUnitsRepository } from "../storage-units/storage-units.repository";
import { StorageUnitsService } from "../storage-units/storage-units.service";
import { FacilityUnitTypesRepository } from "../unit-types/facility-unit-types.repository";
import { FacilityUnitTypesService } from "../unit-types/facility-unit-types.service";
import { BookingsRepository } from "./bookings.repository";
import { BookingsService } from "./bookings.service";
import { CheckInSlotsRepository } from "./check-in-slots.repository";
import { CheckInSlotsService } from "./check-in-slots.service";

export const bookingsRoutes: FastifyPluginAsync = async (fastify) => {
  const bookingsRepository = new BookingsRepository(fastify.db);
  const assignmentsRepository = new FacilityAssignmentsRepository(fastify.db);
  const facilitiesRepository = new FacilitiesRepository(fastify.db);
  const service = new BookingsService(
    bookingsRepository,
    new FacilitiesService(facilitiesRepository),
    new FacilityUnitTypesService(new FacilityUnitTypesRepository(fastify.db), facilitiesRepository),
    new CheckInSlotsService(new CheckInSlotsRepository(fastify.db)),
    new StorageUnitsService(new StorageUnitsRepository(fastify.db)),
  );

  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/bookings/drafts",
    {
      schema: { body: BookingDraftInputSchema },
      preHandler: [optionalAuth],
    },
    async (request, reply) => {
      return reply
        .status(201)
        .send(successResponse(await service.createDraft(request.body, request.user?.id)));
    },
  );

  // GET /api/facilities/:facilityId/bookings - List bookings in facility (FM, Admin, BOM)
  typedApp.get(
    "/facilities/:facilityId/bookings",
    {
      schema: {
        params: FacilityBookingsParamsSchema,
        querystring: BookingListQuerySchema,
      },
      preHandler: [
        requireFacilityAccess({
          allowedFacilityRoles: ["FACILITY_MANAGER"],
        }),
      ],
    },
    async (request, reply) => {
      const { facilityId } = request.params;
      const { status } = request.query;
      const bookings = await service.getFacilityBookings(facilityId, status);
      return reply.status(200).send(successResponse(bookings));
    },
  );

  // GET /api/bookings/assigned-to-me - List bookings assigned to the current user
  typedApp.get(
    "/bookings/assigned-to-me",
    {
      schema: {
        querystring: StaffTasksQuerySchema,
      },
      preHandler: [requireRole("FACILITY_STAFF")],
    },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw new UnauthorizedError();
      const { facilityId } = request.query;
      const tasks = await service.getStaffTasks(user.id, facilityId);
      return reply.status(200).send(successResponse(tasks));
    },
  );

  // GET /api/bookings/:id - Get booking details
  typedApp.get(
    "/bookings/:id",
    {
      schema: {
        params: BookingIdParamsSchema,
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const booking = await service.getBookingById(id);

      // Verify facility scope access
      const user = request.user;
      if (!user) throw new UnauthorizedError();
      const scope = getFacilityAccessScope(user);
      await requireAssignedFacility(assignmentsRepository, booking.facilityId, scope, [
        "FACILITY_MANAGER",
        "FACILITY_STAFF",
      ]);

      return reply.status(200).send(successResponse(booking));
    },
  );

  // GET /api/bookings/:id/eligible-units - Get list of physical units available for assignment
  typedApp.get(
    "/bookings/:id/eligible-units",
    {
      schema: {
        params: BookingIdParamsSchema,
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const booking = await service.getBookingById(id);

      const user = request.user;
      if (!user) throw new UnauthorizedError();
      const scope = getFacilityAccessScope(user);
      await requireAssignedFacility(assignmentsRepository, booking.facilityId, scope, [
        "FACILITY_MANAGER",
      ]);

      const units = await service.getEligibleUnits(id);
      return reply.status(200).send(successResponse(units));
    },
  );

  // POST /api/bookings/:id/assign-unit - Facility Manager manually assigns a physical unit
  typedApp.post(
    "/bookings/:id/assign-unit",
    {
      schema: {
        params: BookingIdParamsSchema,
        body: AssignPhysicalUnitBodySchema,
      },
      preHandler: [requireRole("FACILITY_MANAGER")],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { physicalUnitId, reason } = request.body;

      const user = request.user;
      if (!user) throw new UnauthorizedError();
      const scope = getFacilityAccessScope(user);

      const booking = await service.getBookingById(id);
      await requireAssignedFacility(assignmentsRepository, booking.facilityId, scope, [
        "FACILITY_MANAGER",
      ]);

      const assignment = await service.assignPhysicalUnit(id, physicalUnitId, user.id, reason);
      return reply.status(200).send(successResponse(assignment));
    },
  );

  // POST /api/bookings/:id/assign-staff - Facility Manager assigns a staff member
  typedApp.post(
    "/bookings/:id/assign-staff",
    {
      schema: {
        params: BookingIdParamsSchema,
        body: AssignStaffBodySchema,
      },
      preHandler: [requireRole("FACILITY_MANAGER")],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { staffId } = request.body;

      const user = request.user;
      if (!user) throw new UnauthorizedError();
      const scope = getFacilityAccessScope(user);

      const booking = await service.getBookingById(id);
      await requireAssignedFacility(assignmentsRepository, booking.facilityId, scope, [
        "FACILITY_MANAGER",
      ]);

      const updatedBooking = await service.assignStaff(id, staffId);
      return reply.status(200).send(successResponse(updatedBooking));
    },
  );
};
