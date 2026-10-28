import {
  CreateReservationSchema,
  ReservationQuerySchema,
  ResourceIdSchema,
  UpdateReservationSchema,
  UserRole,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { getAuthenticatedActor } from "../auth/authenticated-actor";
import { FacilitiesRepository } from "../facilities/facilities.repository";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import { RESERVATION_MESSAGES } from "./reservations.messages";
import { ReservationsRepository } from "./reservations.repository";
import { ReservationsService } from "./reservations.service";

export const reservationsRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  const facilityAssignmentsService = new FacilityAssignmentsService(
    new FacilityAssignmentsRepository(app.db),
    new FacilitiesRepository(app.db),
  );
  const reservationsService = new ReservationsService(
    new ReservationsRepository(app.db),
    facilityAssignmentsService,
  );
  const reservationReadAccess = requireRole(
    UserRole.STORAGE_CUSTOMER,
    UserRole.FACILITY_STAFF,
    UserRole.FACILITY_MANAGER,
  );
  const customerAccess = requireRole(UserRole.STORAGE_CUSTOMER);

  typedApp.post(
    "/",
    {
      preHandler: [customerAccess],
      schema: {
        tags: [RESERVATION_MESSAGES.tag],
        summary: RESERVATION_MESSAGES.createSummary,
        body: CreateReservationSchema,
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          successResponse(
            await reservationsService.createReservation(
              request.body,
              getAuthenticatedActor(request),
            ),
          ),
        ),
  );
  typedApp.get(
    "/",
    {
      preHandler: [reservationReadAccess],
      schema: {
        tags: [RESERVATION_MESSAGES.tag],
        summary: RESERVATION_MESSAGES.listSummary,
        querystring: ReservationQuerySchema,
      },
    },
    async (request) =>
      successResponse(
        await reservationsService.listReservations(
          request.query,
          getAuthenticatedActor(request, request.query.facilityId),
        ),
      ),
  );
  typedApp.get(
    "/:id",
    {
      preHandler: [reservationReadAccess],
      schema: {
        tags: [RESERVATION_MESSAGES.tag],
        summary: RESERVATION_MESSAGES.detailSummary,
        params: ResourceIdSchema,
      },
    },
    async (request) =>
      successResponse(
        await reservationsService.getReservation(request.params.id, getAuthenticatedActor(request)),
      ),
  );
  typedApp.patch(
    "/:id",
    {
      preHandler: [customerAccess],
      schema: {
        tags: [RESERVATION_MESSAGES.tag],
        summary: RESERVATION_MESSAGES.updateSummary,
        params: ResourceIdSchema,
        body: UpdateReservationSchema,
      },
    },
    async (request) =>
      successResponse(
        await reservationsService.updateReservation(
          request.params.id,
          request.body,
          getAuthenticatedActor(request),
        ),
      ),
  );
};
