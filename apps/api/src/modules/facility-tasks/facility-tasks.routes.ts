import {
  AssignFacilityTaskSchema,
  CreateFacilityTaskReportSchema,
  CreateFacilityTaskSchema,
  FacilityTaskListQuerySchema,
  FacilityTaskParamsSchema,
  FacilityTaskReportListQuerySchema,
  FacilityTaskReportParamsSchema,
  FACILITY_TASK_MESSAGES as m,
} from "@metastorage/contracts";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { FacilityTasksRepository } from "./facility-tasks.repository";
import { FacilityTasksService } from "./facility-tasks.service";
import { facilityTaskSwaggerTransform } from "./facility-tasks.swagger";

export const facilityTasksRoutes: FastifyPluginAsync = async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const service = new FacilityTasksService(
    new FacilityTasksRepository(app.db),
    new FacilityAssignmentsRepository(app.db),
  );
  app.addHook("onRequest", async (_req, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
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
    async (req, reply) =>
      reply.status(201).send(successResponse(await service.create(req.body, actor(req)))),
  );
  typed.get(
    "/",
    {
      config: { swaggerTransform: facilityTaskSwaggerTransform("list") },
      preHandler: [requireRole("FACILITY_MANAGER", "FACILITY_STAFF")],
      schema: {
        tags: ["Facility Tasks"],
        summary: m.listSummary,
        querystring: FacilityTaskListQuerySchema,
      },
    },
    async (req) => successResponse(await service.list(req.query, actor(req))),
  );
  typed.get(
    "/:id",
    {
      config: { swaggerTransform: facilityTaskSwaggerTransform("detail") },
      preHandler: [requireRole("FACILITY_MANAGER", "FACILITY_STAFF")],
      schema: {
        tags: ["Facility Tasks"],
        summary: m.detailSummary,
        params: FacilityTaskParamsSchema,
      },
    },
    async (req) => successResponse(await service.detail(req.params.id, actor(req))),
  );
  typed.post(
    "/:id/start",
    {
      config: { swaggerTransform: facilityTaskSwaggerTransform("start") },
      preHandler: [requireRole("FACILITY_STAFF")],
      schema: {
        tags: ["Facility Tasks"],
        summary: m.taskStartSummary,
        params: FacilityTaskParamsSchema,
      },
    },
    async (req) => successResponse(await service.start(req.params.id, actor(req)), m.taskStarted),
  );
  typed.post(
    "/:id/reports",
    {
      config: { swaggerTransform: facilityTaskSwaggerTransform("report-create") },
      preHandler: [requireRole("FACILITY_STAFF")],
      schema: {
        tags: ["Facility Tasks"],
        summary: m.reportCreateSummary,
        params: FacilityTaskParamsSchema,
        body: CreateFacilityTaskReportSchema,
      },
    },
    async (req, reply) =>
      reply
        .status(201)
        .send(
          successResponse(
            await service.submitReport(req.params.id, req.body, actor(req)),
            m.reportCreated,
          ),
        ),
  );
  typed.get(
    "/:id/reports",
    {
      config: { swaggerTransform: facilityTaskSwaggerTransform("report-list") },
      preHandler: [requireRole("FACILITY_MANAGER", "FACILITY_STAFF")],
      schema: {
        tags: ["Facility Tasks"],
        summary: m.reportListSummary,
        params: FacilityTaskParamsSchema,
        querystring: FacilityTaskReportListQuerySchema,
      },
    },
    async (req) => successResponse(await service.listReports(req.params.id, req.query, actor(req))),
  );
  typed.post(
    "/:id/reports/:reportId/accept",
    {
      config: { swaggerTransform: facilityTaskSwaggerTransform("accept-report") },
      preHandler: [requireRole("FACILITY_MANAGER")],
      schema: {
        tags: ["Facility Tasks"],
        summary: m.taskAcceptSummary,
        params: FacilityTaskReportParamsSchema,
      },
    },
    async (req) =>
      successResponse(
        await service.acceptReport(req.params.id, req.params.reportId, actor(req)),
        m.taskAccepted,
      ),
  );
  typed.post(
    "/:id/assign",
    {
      config: { swaggerTransform: facilityTaskSwaggerTransform("assign") },
      preHandler: [requireRole("FACILITY_MANAGER")],
      schema: {
        tags: ["Facility Tasks"],
        summary: m.assignSummary,
        params: FacilityTaskParamsSchema,
        body: AssignFacilityTaskSchema,
      },
    },
    async (req) => successResponse(await service.assign(req.params.id, req.body, actor(req))),
  );
};

function actor(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return { id: request.user.id, role: request.user.role };
}
