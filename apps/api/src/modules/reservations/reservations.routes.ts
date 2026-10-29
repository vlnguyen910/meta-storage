import {
  BookingDraftInputSchema,
  BookingPaymentInputSchema,
  FacilityBookingsParamsSchema,
  ReservationIdSchema,
  ReservationQuerySchema,
} from "@metastorage/contracts";
import { UserRole } from "@metastorage/database/schema/user-enums";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireAuth, requireRole } from "../auth/auth.guard";
import { requireFacilityAccess } from "../facilities/facilities.guard";
import { ReservationsService } from "./reservations.service";

export const reservationsRoutes: FastifyPluginAsync = async (app) => {
  const service = new ReservationsService();
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/drafts",
    { schema: { body: BookingDraftInputSchema }, preHandler: [requireRole("CUSTOMER")] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply
        .status(201)
        .send(successResponse(service.createReservationDraft(request.body, request.user.id)));
    },
  );

  typed.post(
    "/:id/pay",
    {
      schema: { params: ReservationIdSchema, body: BookingPaymentInputSchema },
      preHandler: [requireRole("CUSTOMER")],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply
        .status(201)
        .send(
          successResponse(
            service.startReservationPayment(request.params.id, request.body, request.user.id),
          ),
        );
    },
  );

  typed.get(
    "/mine",
    { schema: { querystring: ReservationQuerySchema }, preHandler: [requireRole("CUSTOMER")] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(service.listCustomerReservations(request.user.id, request.query)),
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
          service.listFacilityReservations(
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
        successResponse(service.getReservation(request.params.id, request.user.id)),
      );
    },
  );
};
