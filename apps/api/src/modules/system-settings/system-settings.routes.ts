import {
  ConfigureSystemSettingSchema,
  SystemSettingHistoryQuerySchema,
  SystemSettingParamsSchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireAuth } from "../auth/auth.guard";
import { SystemSettingsRepository } from "./system-settings.repository";
import { SystemSettingsService } from "./system-settings.service";

function actor(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return { id: request.user.id, role: request.user.role };
}
export const systemSettingsRoutes: FastifyPluginAsync = async (app) => {
  const service = new SystemSettingsService(new SystemSettingsRepository(app.db));
  const typed = app.withTypeProvider<ZodTypeProvider>();
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  typed.get("/system-settings", { preHandler: [requireAuth] }, async (req) =>
    successResponse(await service.list(actor(req))),
  );
  typed.put(
    "/system-settings",
    { preHandler: [requireAuth], schema: { body: ConfigureSystemSettingSchema } },
    async (req) => successResponse(await service.update(actor(req), req.body)),
  );
  typed.get(
    "/system-settings/:key/history",
    {
      preHandler: [requireAuth],
      schema: { params: SystemSettingParamsSchema, querystring: SystemSettingHistoryQuerySchema },
    },
    async (req) => successResponse(await service.history(actor(req), req.params.key, req.query)),
  );
};
