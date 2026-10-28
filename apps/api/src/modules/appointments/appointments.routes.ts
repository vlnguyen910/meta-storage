import {
  AppointmentQuerySchema,
  CreateAppointmentSchema,
  ResourceIdSchema,
  UpdateAppointmentSchema,
  UserRole,
  UserRoleSchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { FacilitiesRepository } from "../facilities/facilities.repository";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import { AppointmentsRepository } from "./appointments.repository";
import { AppointmentsService } from "./appointments.service";

export const appointmentsRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  const assignments = new FacilityAssignmentsService(
    new FacilityAssignmentsRepository(app.db),
    new FacilitiesRepository(app.db),
  );
  const service = new AppointmentsService(new AppointmentsRepository(app.db), assignments);
  const authenticated = requireRole(
    UserRole.STORAGE_CUSTOMER,
    UserRole.FACILITY_STAFF,
    UserRole.FACILITY_MANAGER,
  );

  typedApp.get(
    "/slots",
    {
      preHandler: [authenticated],
      schema: { tags: ["Lịch hẹn"], summary: "Danh sách khung giờ hẹn" },
    },
    async () => successResponse(await service.listSlots()),
  );

  typedApp.post(
    "/",
    {
      preHandler: [requireRole(UserRole.STORAGE_CUSTOMER)],
      schema: { tags: ["Lịch hẹn"], summary: "Tạo lịch hẹn", body: CreateAppointmentSchema },
    },
    async (request, reply) =>
      reply.status(201).send(successResponse(await service.create(request.body, actor(request)))),
  );
  typedApp.get(
    "/",
    {
      preHandler: [authenticated],
      schema: {
        tags: ["Lịch hẹn"],
        summary: "Danh sách lịch hẹn",
        querystring: AppointmentQuerySchema,
      },
    },
    async (request) => successResponse(await service.list(request.query, actor(request))),
  );
  typedApp.get(
    "/:id",
    {
      preHandler: [authenticated],
      schema: { tags: ["Lịch hẹn"], summary: "Chi tiết lịch hẹn", params: ResourceIdSchema },
    },
    async (request) => successResponse(await service.get(request.params.id, actor(request))),
  );
  typedApp.patch(
    "/:id",
    {
      preHandler: [authenticated],
      schema: {
        tags: ["Lịch hẹn"],
        summary: "Chỉnh sửa lịch hẹn",
        params: ResourceIdSchema,
        body: UpdateAppointmentSchema,
      },
    },
    async (request) =>
      successResponse(await service.update(request.params.id, request.body, actor(request))),
  );
};

function actor(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return { id: request.user.id, role: UserRoleSchema.parse(request.user.role) };
}
