import {
  CreateFacilityTaskSchema,
  FacilityTaskListQuerySchema,
  FacilityTaskParamsSchema,
  FACILITY_TASK_MESSAGES as m,
  StaffFacilityTaskListQuerySchema,
  UpdateFacilityTaskSchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { FacilitiesRepository } from "../facilities/facilities.repository";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { FacilityAssignmentsService } from "../facilities/facility-assignments.service";
import { FacilityTasksRepository } from "./facility-tasks.repository";
import { FacilityTasksService } from "./facility-tasks.service";
import { facilityTaskSwaggerTransform } from "./facility-tasks.swagger";

export const facilityTasksRoutes: FastifyPluginAsync = async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const assignmentRepository = new FacilityAssignmentsRepository(app.db);
  const service = new FacilityTasksService(
    new FacilityTasksRepository(app.db, assignmentRepository),
    new FacilityAssignmentsService(assignmentRepository, new FacilitiesRepository(app.db)),
  );

  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });

  typed.get(
    "/dashboard/my",
    {
      config: { swaggerTransform: facilityTaskSwaggerTransform("dashboard") },
      preHandler: [requireRole("FACILITY_STAFF")],
      schema: { tags: ["Facility Tasks"], summary: m.myDashboardSummary },
    },
    async (request) => successResponse(await service.dashboardForStaff(actor(request))),
  );

  typed.post(
    "/",
    {
      config: { swaggerTransform: facilityTaskSwaggerTransform("create") },
      preHandler: [requireRole("FACILITY_MANAGER")],
      schema: {
        tags: ["Facility Tasks"],
        summary: m.createSummary,
        body: CreateFacilityTaskSchema,
      },
    },
    async (request, reply) =>
      reply.status(201).send(successResponse(await service.create(request.body, actor(request)))),
  );

  typed.get(
    "/my",
    {
      config: { swaggerTransform: facilityTaskSwaggerTransform("list") },
      preHandler: [requireRole("FACILITY_STAFF")],
      schema: {
        tags: ["Facility Tasks"],
        summary: m.myTasksSummary,
        querystring: StaffFacilityTaskListQuerySchema,
      },
    },
    async (request) => successResponse(await service.listMineTask(request.query, actor(request))),
  );

  typed.get(
    "/facility",
    {
      config: { swaggerTransform: facilityTaskSwaggerTransform("list") },
      preHandler: [requireRole("FACILITY_MANAGER")],
      schema: {
        tags: ["Facility Tasks"],
        summary: m.facilityTasksSummary,
        querystring: FacilityTaskListQuerySchema,
      },
    },
    async (request) => successResponse(await service.listFacility(request.query, actor(request))),
  );

  typed.patch(
    "/:id",
    {
      config: { swaggerTransform: facilityTaskSwaggerTransform("update") },
      preHandler: [requireRole("FACILITY_MANAGER", "FACILITY_STAFF")],
      schema: {
        tags: ["Facility Tasks"],
        summary: m.updateSummary,
        params: FacilityTaskParamsSchema,
        body: UpdateFacilityTaskSchema,
      },
    },
    async (request) =>
      successResponse(
        await service.update(request.params.id, request.body, actor(request)),
        "status" in request.body && request.body.status === "CANCELLED"
          ? m.taskCancelled
          : m.updated,
      ),
  );
};

function actor(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return { id: request.user.id, role: request.user.role };
}
