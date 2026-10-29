import {
  CreateReservationSchema,
  ReservationIdSchema,
  ReservationQuerySchema,
  UpdateReservationSchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireAuth, requireRole } from "../auth/auth.guard";
import { FacilitiesRepository } from "../facilities/facilities.repository";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import { PricingRepository } from "../pricing/pricing.repository";
import { PricingService } from "../pricing/pricing.service";
import { ReservationsRepository } from "./reservations.repository";
import { ReservationsService } from "./reservations.service";

export const reservationsRoutes: FastifyPluginAsync = async (app) => {
  const assignments = new FacilityAssignmentsRepository(app.db);
  const service = new ReservationsService(
    new ReservationsRepository(app.db),
    new PricingService(new PricingRepository(app.db)),
    new FacilityAssignmentsService(assignments, new FacilitiesRepository(app.db)),
  );
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.post(
    "/",
    { schema: { body: CreateReservationSchema }, preHandler: [requireRole("CUSTOMER")] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply
        .status(201)
        .send(successResponse(await service.create(request.body, request.user)));
    },
  );
  typed.get(
    "/",
    { schema: { querystring: ReservationQuerySchema }, preHandler: [requireAuth] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(successResponse(await service.list(request.query, request.user)));
    },
  );
  typed.get(
    "/:id",
    { schema: { params: ReservationIdSchema }, preHandler: [requireAuth] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(successResponse(await service.get(request.params.id, request.user)));
    },
  );
  typed.patch(
    "/:id",
    {
      schema: { params: ReservationIdSchema, body: UpdateReservationSchema },
      preHandler: [requireRole("CUSTOMER")],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(await service.update(request.params.id, request.body, request.user)),
      );
    },
  );
};
