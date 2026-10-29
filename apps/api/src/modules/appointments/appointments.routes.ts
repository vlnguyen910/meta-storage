import {
  AppointmentIdSchema,
  AppointmentQuerySchema,
  AssignStaffBodySchema,
  CreateAppointmentSchema,
  UpdateAppointmentSchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireAuth, requireRole } from "../auth/auth.guard";
import { AppointmentsService } from "./appointments.service";

export const appointmentsRoutes: FastifyPluginAsync = async (app) => {
  const service = new AppointmentsService();
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/check-in-slots", async (_request, reply) =>
    reply.send(successResponse(service.listCheckInSlots())),
  );

  typed.post(
    "/",
    { schema: { body: CreateAppointmentSchema }, preHandler: [requireRole("CUSTOMER")] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply
        .status(201)
        .send(successResponse(service.scheduleAppointment(request.body, request.user.id)));
    },
  );

  typed.get(
    "/mine",
    { schema: { querystring: AppointmentQuerySchema }, preHandler: [requireAuth] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(service.listCustomerAppointments(request.query, request.user.id)),
      );
    },
  );

  typed.get(
    "/facilities/:facilityId",
    { schema: { querystring: AppointmentQuerySchema }, preHandler: [requireAuth] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(service.listFacilityAppointments(request.query, request.user.id)),
      );
    },
  );

  typed.get(
    "/:id",
    { schema: { params: AppointmentIdSchema }, preHandler: [requireAuth] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(service.getAppointment(request.params.id, request.user.id)),
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
          service.assignAppointmentStaff(request.params.id, request.body, request.user.id),
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
          service.updateAppointment(request.params.id, request.body, request.user.id),
        ),
      );
    },
  );
};
