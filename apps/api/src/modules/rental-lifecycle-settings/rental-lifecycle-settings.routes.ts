import { ConfigureRentalLifecycleSettingSchema } from "@metastorage/contracts";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireAuth } from "../auth/auth.guard";
import { RentalLifecycleSettingsRepository } from "./rental-lifecycle-settings.repository";
import { RentalLifecycleSettingsService } from "./rental-lifecycle-settings.service";

function actor(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return { id: request.user.id, role: request.user.role };
}

export const rentalLifecycleSettingsRoutes: FastifyPluginAsync = async (app) => {
  const service = new RentalLifecycleSettingsService(new RentalLifecycleSettingsRepository(app.db));
  const typed = app.withTypeProvider<ZodTypeProvider>();
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  typed.get("/return-policy/lifecycle-settings", { preHandler: [requireAuth] }, async (req) =>
    successResponse(await service.list(actor(req))),
  );
  typed.put(
    "/return-policy/lifecycle-settings",
    { preHandler: [requireAuth], schema: { body: ConfigureRentalLifecycleSettingSchema } },
    async (req) => successResponse(await service.update(actor(req), req.body)),
  );
};
