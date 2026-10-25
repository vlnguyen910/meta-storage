import { LoginHistoryQuerySchema, UserActivityLogQuerySchema } from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { UserHistoryRepository } from "./user-history.repository";
import { UserHistoryService } from "./user-history.service";

export const userHistoryRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const service = new UserHistoryService(new UserHistoryRepository(fastify.db));
  app.get(
    "/login-history",
    {
      preHandler: [requireRole("SYSTEM_ADMIN")],
      schema: { tags: ["User history"], querystring: LoginHistoryQuerySchema },
    },
    async (request) => successResponse(await service.loginHistory(request.query)),
  );
  app.get(
    "/activity-logs",
    {
      preHandler: [requireRole("SYSTEM_ADMIN")],
      schema: { tags: ["User history"], querystring: UserActivityLogQuerySchema },
    },
    async (request) => successResponse(await service.activityLogs(request.query)),
  );
};
