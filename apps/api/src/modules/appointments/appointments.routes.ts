import {
  AppointmentQuerySchema,
  CreateAppointmentSchema,
  ResourceIdSchema,
  UpdateAppointmentSchema,
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
import { APPOINTMENT_MESSAGES } from "./appointments.messages";
import { AppointmentsRepository } from "./appointments.repository";
import { AppointmentsService } from "./appointments.service";

export const appointmentsRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  const facilityAssignmentsService = new FacilityAssignmentsService(
    new FacilityAssignmentsRepository(app.db),
    new FacilitiesRepository(app.db),
  );
  const appointmentsService = new AppointmentsService(
    new AppointmentsRepository(app.db),
    facilityAssignmentsService,
  );
  const appointmentAccess = requireRole(
    UserRole.STORAGE_CUSTOMER,
    UserRole.FACILITY_STAFF,
    UserRole.FACILITY_MANAGER,
  );

  typedApp.get(
    "/slots",
    {
      schema: { tags: [APPOINTMENT_MESSAGES.tag], summary: APPOINTMENT_MESSAGES.listSlotsSummary },
    },
    async () => successResponse(await appointmentsService.listSlots()),
  );

  typedApp.post(
    "/",
    {
      preHandler: [requireRole(UserRole.STORAGE_CUSTOMER)],
      schema: {
        tags: [APPOINTMENT_MESSAGES.tag],
        summary: APPOINTMENT_MESSAGES.createSummary,
        body: CreateAppointmentSchema,
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          successResponse(
            await appointmentsService.createAppointment(
              request.body,
              getAuthenticatedActor(request),
            ),
          ),
        ),
  );
  typedApp.get(
    "/",
    {
      preHandler: [appointmentAccess],
      schema: {
        tags: [APPOINTMENT_MESSAGES.tag],
        summary: APPOINTMENT_MESSAGES.listSummary,
        querystring: AppointmentQuerySchema,
      },
    },
    async (request) =>
      successResponse(
        await appointmentsService.listAppointments(
          request.query,
          getAuthenticatedActor(request, request.query.facilityId),
        ),
      ),
  );
  typedApp.get(
    "/:id",
    {
      preHandler: [appointmentAccess],
      schema: {
        tags: [APPOINTMENT_MESSAGES.tag],
        summary: APPOINTMENT_MESSAGES.detailSummary,
        params: ResourceIdSchema,
      },
    },
    async (request) =>
      successResponse(
        await appointmentsService.getAppointment(request.params.id, getAuthenticatedActor(request)),
      ),
  );
  typedApp.patch(
    "/:id",
    {
      preHandler: [appointmentAccess],
      schema: {
        tags: [APPOINTMENT_MESSAGES.tag],
        summary: APPOINTMENT_MESSAGES.updateSummary,
        params: ResourceIdSchema,
        body: UpdateAppointmentSchema,
      },
    },
    async (request) =>
      successResponse(
        await appointmentsService.updateAppointment(
          request.params.id,
          request.body,
          getAuthenticatedActor(request),
        ),
      ),
  );
};
