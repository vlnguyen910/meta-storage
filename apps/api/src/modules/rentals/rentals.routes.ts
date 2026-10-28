import {
  FacilityRentalHistoryQuerySchema,
  FacilityRentalListParamsSchema,
  FacilityRentalListQuerySchema,
  FacilityRentalParamsSchema,
  RentalIdParamsSchema,
  RentalPageQuerySchema,
} from "@metastorage/contracts";
import type { Database } from "@metastorage/database";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { FacilitiesRepository } from "../facilities/facilities.repository";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import { RentalsRepository } from "./rentals.repository";
import { RentalsService } from "./rentals.service";

export const rentalsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = createRentalsService(fastify.db);
  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/mine",
    { schema: { querystring: RentalPageQuerySchema }, preHandler: [requireRole("CUSTOMER")] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(await service.listCustomerRentals(request.user.id, request.query)),
      );
    },
  );

  typedApp.get(
    "/:rentalId/payments",
    { schema: { params: RentalIdParamsSchema }, preHandler: [requireRole("CUSTOMER")] },
    async (request, reply) => {
      reply.header("Cache-Control", "private, no-store");
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(
          await service.listCustomerRentalPayments(request.params.rentalId, request.user.id),
        ),
      );
    },
  );

  typedApp.get(
    "/:rentalId",
    { schema: { params: RentalIdParamsSchema }, preHandler: [requireRole("CUSTOMER")] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(await service.getCustomerRental(request.params.rentalId, request.user.id)),
      );
    },
  );

  typedApp.get(
    "/facility/:facilityId",
    {
      schema: {
        tags: ["Rentals"],
        params: FacilityRentalListParamsSchema,
        querystring: FacilityRentalListQuerySchema,
      },
      preHandler: [requireRole("FACILITY_MANAGER")],
    },
    async (request, reply) => {
      reply.header("Cache-Control", "private, no-store");
      if (!request.user) throw new UnauthorizedError();
      return successResponse(
        await service.listFacilityRentals(request.user, request.params.facilityId, request.query),
      );
    },
  );

  typedApp.get(
    "/facility/:facilityId/:rentalId",
    {
      schema: { tags: ["Rentals"], params: FacilityRentalParamsSchema },
      preHandler: [requireRole("FACILITY_MANAGER")],
    },
    async (request, reply) => {
      reply.header("Cache-Control", "private, no-store");
      if (!request.user) throw new UnauthorizedError();
      return successResponse(
        await service.getFacilityRental(
          request.user,
          request.params.facilityId,
          request.params.rentalId,
        ),
      );
    },
  );

  typedApp.get(
    "/facility/:facilityId/:rentalId/payments",
    {
      schema: {
        tags: ["Rentals"],
        params: FacilityRentalParamsSchema,
        querystring: FacilityRentalHistoryQuerySchema,
      },
      preHandler: [requireRole("FACILITY_MANAGER")],
    },
    async (request, reply) => {
      reply.header("Cache-Control", "private, no-store");
      if (!request.user) throw new UnauthorizedError();
      return successResponse(
        await service.listFacilityRentalPayments(
          request.user,
          request.params.facilityId,
          request.params.rentalId,
          request.query,
        ),
      );
    },
  );
};

function createRentalsService(database: Database) {
  return new RentalsService(
    new RentalsRepository(database),
    new FacilityAssignmentsService(
      new FacilityAssignmentsRepository(database),
      new FacilitiesRepository(database),
    ),
  );
}
