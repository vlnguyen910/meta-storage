import {
  AppointmentIdSchema,
  AppointmentQuerySchema,
  AssignStaffBodySchema,
  CreateAppointmentSchema,
  FacilityBookingsParamsSchema,
  UpdateAppointmentSchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireAuth, requireRole } from "../auth/auth.guard";
import { createAppointmentsService } from "./appointments.service";

export const appointmentsRoutes: FastifyPluginAsync = async (app) => {
  const service = createAppointmentsService(app.db);
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/check-in-slots", async (_request, reply) =>
    reply.send(successResponse(await service.listCheckInSlots())),
  );

  typed.post(
    "/",
    { schema: { body: CreateAppointmentSchema }, preHandler: [requireRole("CUSTOMER")] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply
        .status(201)
        .send(successResponse(await service.scheduleAppointment(request.body, request.user.id)));
    },
  );

  typed.get(
    "/mine",
    { schema: { querystring: AppointmentQuerySchema }, preHandler: [requireAuth] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(await service.listCustomerAppointments(request.query, request.user.id)),
      );
    },
  );

  typed.get(
    "/facilities/:facilityId",
    {
      schema: { params: FacilityBookingsParamsSchema, querystring: AppointmentQuerySchema },
      preHandler: [requireRole("FACILITY_MANAGER")],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(
          await service.listFacilityAppointments(
            request.params.facilityId,
            request.query,
            request.user,
          ),
        ),
      );
    },
  );

  typed.get(
    "/assigned-to-me",
    {
      schema: { querystring: AppointmentQuerySchema },
      preHandler: [requireRole("FACILITY_STAFF")],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(await service.listAssignedAppointments(request.user.id, request.query)),
      );
    },
  );

  typed.get(
    "/:id",
    { schema: { params: AppointmentIdSchema }, preHandler: [requireAuth] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(await service.getAppointment(request.params.id, request.user)),
      );
    },
  );

  typed.post(
    "/:id/assign-staff",
    {
      schema: { params: AppointmentIdSchema, body: AssignStaffBodySchema },
      preHandler: [requireRole("FACILITY_MANAGER")],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(
          await service.assignAppointmentStaff(request.params.id, request.body, request.user.id),
        ),
      );
    },
  );

  typed.patch(
    "/:id",
    {
      schema: { params: AppointmentIdSchema, body: UpdateAppointmentSchema },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(
          await service.updateAppointment(request.params.id, request.body, request.user),
        ),
      );
    },
  );
};
