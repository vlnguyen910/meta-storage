import {
  MonthlyRevenueQuerySchema,
  REPORT_MESSAGES as m,
  RentalReportQuerySchema,
  ReportExportQuerySchema,
  RevenueReportQuerySchema,
  UtilizationReportQuerySchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { ReportsRepository } from "./reports.repository";
import { ReportsService } from "./reports.service";

export const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const service = new ReportsService(new ReportsRepository(fastify.db));
  const preHandler = [
    requireRole("BUSINESS_OPERATION_MANAGER", "SYSTEM_ADMIN", "FACILITY_MANAGER"),
  ];
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  app.get(
    "/reconciliation",
    {
      preHandler,
      schema: {
        tags: ["Reports"],
        description: m.reconciliationDescription,
        querystring: UtilizationReportQuerySchema,
      },
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(successResponse(await service.reconciliation(request.query, request.user)));
    },
  );
  app.get(
    "/overview",
    {
      preHandler,
      schema: {
        tags: ["Reports"],
        summary: m.overviewSummary,
        description: m.revenueDescription,
        querystring: RevenueReportQuerySchema,
      },
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(successResponse(await service.overview(request.query, request.user)));
    },
  );
  app.get(
    "/revenue/monthly",
    {
      preHandler,
      schema: {
        tags: ["Reports"],
        description: m.monthlyDescription,
        querystring: MonthlyRevenueQuerySchema,
      },
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(successResponse(await service.monthlyRevenue(request.query, request.user)));
    },
  );
  app.get(
    "/revenue",
    {
      preHandler,
      schema: {
        tags: ["Reports"],
        description: m.revenueDescription,
        querystring: RevenueReportQuerySchema,
      },
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(successResponse(await service.revenue(request.query, request.user)));
    },
  );
  app.get(
    "/utilization",
    {
      preHandler,
      schema: {
        tags: ["Reports"],
        description: m.utilizationDescription,
        querystring: UtilizationReportQuerySchema,
      },
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(successResponse(await service.utilization(request.query, request.user)));
    },
  );
  app.get(
    "/rentals",
    { preHandler, schema: { tags: ["Reports"], querystring: RentalReportQuerySchema } },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(successResponse(await service.rentals(request.query, request.user)));
    },
  );
  app.get(
    "/export",
    { preHandler, schema: { tags: ["Reports"], querystring: ReportExportQuerySchema } },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      const result = await service.export(request.query, request.user);
      return reply
        .type("text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="${result.filename}"`)
        .send(result.body);
    },
  );
};
