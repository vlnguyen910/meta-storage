import { NotificationInboxQuerySchema } from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { LifecycleNotificationsRepository } from "./lifecycle-notifications.repository";
import { LifecycleNotificationsService } from "./lifecycle-notifications.service";

export const lifecycleNotificationsRoutes: FastifyPluginAsync = async (app) => {
  const service = new LifecycleNotificationsService(new LifecycleNotificationsRepository(app.db));
  app.withTypeProvider<ZodTypeProvider>().get(
    "/notifications",
    {
      preHandler: [requireRole("CUSTOMER", "FACILITY_MANAGER")],
      schema: { querystring: NotificationInboxQuerySchema },
    },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      reply.header("Cache-Control", "private, no-store");
      return successResponse(
        await service.inbox(request.user.id, request.user.role ?? "", request.query),
      );
    },
  );
};
