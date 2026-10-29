import {
  AppointmentIdSchema,
  AppointmentQuerySchema,
  CreateAppointmentSchema,
  UpdateAppointmentSchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireAuth, requireRole } from "../auth/auth.guard";
import { FacilitiesRepository } from "../facilities/facilities.repository";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import { AppointmentsRepository } from "./appointments.repository";
import { AppointmentsService } from "./appointments.service";

export const appointmentsRoutes: FastifyPluginAsync = async (app) => {
  const assignmentRepository = new FacilityAssignmentsRepository(app.db);
  const service = new AppointmentsService(
    new AppointmentsRepository(app.db),
    new FacilityAssignmentsService(assignmentRepository, new FacilitiesRepository(app.db)),
  );
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.post(
    "/",
    { schema: { body: CreateAppointmentSchema }, preHandler: [requireRole("CUSTOMER")] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply
        .status(201)
        .send(successResponse(await service.create(request.body, request.user)));
    },
  );
  typed.get(
    "/",
    { schema: { querystring: AppointmentQuerySchema }, preHandler: [requireAuth] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(successResponse(await service.list(request.query, request.user)));
    },
  );
  typed.get(
    "/:id",
    { schema: { params: AppointmentIdSchema }, preHandler: [requireAuth] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(successResponse(await service.get(request.params.id, request.user)));
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
        successResponse(await service.update(request.params.id, request.body, request.user)),
      );
    },
  );
};
