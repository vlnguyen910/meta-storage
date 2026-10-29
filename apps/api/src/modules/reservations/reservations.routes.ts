import {
  CheckoutSessionInputSchema,
  CreateReservationDraftSchema,
  FacilityBookingsParamsSchema,
  ReservationIdSchema,
  ReservationQuerySchema,
  UpdateReservationSchema,
} from "@metastorage/contracts";
import { UserRole } from "@metastorage/database/schema/user-enums";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireAuth, requireRole } from "../auth/auth.guard";
import { requireFacilityAccess } from "../facilities/facilities.guard";
import { createReservationsService } from "./reservations.service";

export const reservationsRoutes: FastifyPluginAsync = async (app) => {
  const service = createReservationsService(app.db);
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/drafts",
    { schema: { body: CreateReservationDraftSchema }, preHandler: [requireRole("CUSTOMER")] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply
        .status(201)
        .send(successResponse(await service.createReservationDraft(request.body, request.user.id)));
    },
  );

  typed.post(
    "/:id/make-payment",
    {
      schema: { params: ReservationIdSchema, body: CheckoutSessionInputSchema },
      preHandler: [requireRole(UserRole.STORAGE_CUSTOMER)],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply
        .status(201)
        .send(
          successResponse(
            await service.startReservationPayment(request.params.id, request.body, request.user.id),
          ),
        );
    },
  );

  typed.patch(
    "/:id",
    {
      schema: { params: ReservationIdSchema, body: UpdateReservationSchema },
      preHandler: [requireRole(UserRole.STORAGE_CUSTOMER)],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(await service.cancelReservation(request.params.id, request.user.id)),
      );
    },
  );

  typed.get(
    "/mine",
    { schema: { querystring: ReservationQuerySchema }, preHandler: [requireRole("CUSTOMER")] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(await service.listCustomerReservations(request.user.id, request.query)),
      );
    },
  );

  typed.get(
    "/facilities/:facilityId",
    {
      schema: { params: FacilityBookingsParamsSchema, querystring: ReservationQuerySchema },
      preHandler: [
        requireRole(UserRole.FACILITY_MANAGER),
        requireFacilityAccess({ allowedFacilityRoles: [UserRole.FACILITY_MANAGER] }),
      ],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(
          await service.listFacilityReservations(
            request.params.facilityId,
            request.query,
            request.user.id,
          ),
        ),
      );
    },
  );

  typed.get(
    "/:id",
    { schema: { params: ReservationIdSchema }, preHandler: [requireAuth] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(await service.getReservation(request.params.id, request.user)),
      );
    },
  );
};
