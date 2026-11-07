import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../../common/errors/app-error";
import { requireRole } from "../auth/auth.guard";
import { SUPPORT_ROUTE_OUTDATED_MESSAGE } from "../support/support.messages";
export const facilityWorkspaceRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (_req, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  const outdated = {
    preHandler: [requireRole("FACILITY_MANAGER", "FACILITY_STAFF", "BUSINESS_OPERATION_MANAGER")],
  };
  const gone = async () => {
    throw new AppError(SUPPORT_ROUTE_OUTDATED_MESSAGE, 410, "ROUTE_OUTDATED");
  };
  app.all("/support", outdated, gone);
  app.all("/support/*", outdated, gone);
};
