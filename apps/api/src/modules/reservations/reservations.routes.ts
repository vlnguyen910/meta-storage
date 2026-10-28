import {
  CreateReservationSchema,
  ReservationQuerySchema,
  ResourceIdSchema,
  UpdateReservationSchema,
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
import { ReservationsRepository } from "./reservations.repository";
import { ReservationsService } from "./reservations.service";

export const reservationsRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  const assignments = new FacilityAssignmentsService(
    new FacilityAssignmentsRepository(app.db),
    new FacilitiesRepository(app.db),
  );
  const service = new ReservationsService(new ReservationsRepository(app.db), assignments);
  const readers = requireRole(
    UserRole.STORAGE_CUSTOMER,
    UserRole.FACILITY_STAFF,
    UserRole.FACILITY_MANAGER,
  );
  const customer = requireRole(UserRole.STORAGE_CUSTOMER);

  typedApp.post(
    "/",
    {
      preHandler: [customer],
      schema: { tags: ["Đặt kho"], summary: "Tạo đặt kho", body: CreateReservationSchema },
    },
    async (request, reply) =>
      reply.status(201).send(successResponse(await service.create(request.body, actor(request)))),
  );
  typedApp.get(
    "/",
    {
      preHandler: [readers],
      schema: {
        tags: ["Đặt kho"],
        summary: "Danh sách đặt kho",
        querystring: ReservationQuerySchema,
      },
    },
    async (request) => successResponse(await service.list(request.query, actor(request))),
  );
  typedApp.get(
    "/:id",
    {
      preHandler: [readers],
      schema: { tags: ["Đặt kho"], summary: "Chi tiết đặt kho", params: ResourceIdSchema },
    },
    async (request) => successResponse(await service.get(request.params.id, actor(request))),
  );
  typedApp.patch(
    "/:id",
    {
      preHandler: [customer],
      schema: {
        tags: ["Đặt kho"],
        summary: "Chỉnh sửa bản nháp đặt kho",
        params: ResourceIdSchema,
        body: UpdateReservationSchema,
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
