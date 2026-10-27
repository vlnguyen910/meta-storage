import { FacilityWorkspaceQuerySchema } from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AppError, UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { SUPPORT_ROUTE_OUTDATED_MESSAGE } from "../support/support.messages";
import { FacilityRentalsRepository } from "./facility-rentals.repository";
import { FacilityRentalsService } from "./facility-rentals.service";
export const facilityWorkspaceRoutes: FastifyPluginAsync = async (app) => {
  const service = new FacilityRentalsService(new FacilityRentalsRepository(app.db));
  app.addHook("onRequest", async (_req, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.get(
    "/rentals",
    {
      preHandler: [requireRole("FACILITY_MANAGER")],
      schema: { tags: ["Facility Workspace"], querystring: FacilityWorkspaceQuerySchema },
    },
    async (req) => successResponse(await service.list(actor(req.user), req.query)),
  );
  typed.get(
    "/rentals/:id",
    {
      preHandler: [requireRole("FACILITY_MANAGER")],
      schema: { tags: ["Facility Workspace"], params: z.object({ id: z.string().uuid() }) },
    },
    async (req) => successResponse(await service.get(actor(req.user), req.params.id)),
  );
  const outdated = {
    preHandler: [requireRole("FACILITY_MANAGER", "FACILITY_STAFF", "BUSINESS_OPERATION_MANAGER")],
  };
  const gone = async () => {
    throw new AppError(SUPPORT_ROUTE_OUTDATED_MESSAGE, 410, "ROUTE_OUTDATED");
  };
  app.all("/support", outdated, gone);
  app.all("/support/*", outdated, gone);
};
function actor(user: { id: string } | null | undefined) {
  if (!user) throw new UnauthorizedError();
  return user.id;
}

