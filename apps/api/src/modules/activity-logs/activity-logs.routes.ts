import { ActivityLogPageSchema, ActivityLogQuerySchema } from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import type { ActivityLogsService } from "./activity-logs.service";

export const activityLogsRoutes: FastifyPluginAsync<{ service: ActivityLogsService }> = async (
  app,
  { service },
) => {
  await service.initialize();
  app.withTypeProvider<ZodTypeProvider>().get(
    "/",
    {
      preHandler: [requireRole("SYSTEM_ADMIN")],
      schema: {
        tags: ["Activity Logs"],
        security: [{ sessionAuth: [] }],
        querystring: ActivityLogQuerySchema,
        response: {
          200: z.object({
            success: z.literal(true),
            data: ActivityLogPageSchema,
            timestamp: z.iso.datetime(),
          }),
        },
      },
    },
    async (request, reply) => {
      reply.header("Cache-Control", "private, no-store");
      return successResponse(await service.list(request.query));
    },
  );
};
