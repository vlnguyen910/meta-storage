import type { CheckInLookupInput } from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireAuth } from "../auth/auth.guard";
import { getFacilityAccessScope, requireAssignedFacility } from "../facilities/facilities.access";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { assertAssignedStaff, assertFlowReadAccess } from "./check-in-access";
import { CheckInsRepository } from "./check-ins.repository";
import { CheckInBookingParamsSchema, CheckInLookupBodySchema } from "./check-ins.schema";
import { CheckInsService } from "./check-ins.service";

const CHECK_IN_ROLES = ["FACILITY_MANAGER", "FACILITY_STAFF"] as const;

export const checkInsRoutes: FastifyPluginAsync = async (fastify) => {
  const checkInsRepository = new CheckInsRepository(fastify.db);
  const assignmentsRepository = new FacilityAssignmentsRepository(fastify.db);
  const service = new CheckInsService(checkInsRepository);
  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/check-ins/lookup",
    {
      schema: { body: CheckInLookupBodySchema },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw new UnauthorizedError();

      const input = request.body as CheckInLookupInput;
      const facilityId = await service.getFacilityIdForLookup(input);
      const scope = getFacilityAccessScope(user);
      await requireAssignedFacility(assignmentsRepository, facilityId, scope, CHECK_IN_ROLES);

      const record = await checkInsRepository.findByLookup(input.type, input.value);
      assertFlowReadAccess(user, record?.booking.assignedStaffId);
      const result = await service.lookup(input);
      return reply.status(200).send(successResponse(result));
    },
  );

  typedApp.post(
    "/check-ins/:bookingId/confirm",
    {
      schema: { params: CheckInBookingParamsSchema },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw new UnauthorizedError();

      const facilityId = await service.getFacilityIdForBooking(request.params.bookingId);
      const scope = getFacilityAccessScope(user);
      await requireAssignedFacility(assignmentsRepository, facilityId, scope, CHECK_IN_ROLES);

      const record = await checkInsRepository.findByBookingId(request.params.bookingId);
      assertAssignedStaff(user, record?.booking.assignedStaffId);
      const result = await service.confirm(request.params.bookingId, user.id);
      return reply.status(200).send(successResponse(result));
    },
  );
};
