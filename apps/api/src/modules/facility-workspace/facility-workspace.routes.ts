import {
  FacilitySupportQuerySchema,
  FacilityWorkspaceQuerySchema,
  FACILITY_WORKSPACE_MESSAGES as M,
  SupportOperationSchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import type { SupportImageStorage } from "../support/support.types";
import { FacilityRentalsRepository } from "./facility-rentals.repository";
import { FacilityRentalsService } from "./facility-rentals.service";
import { SupportOperationsRepository } from "./support-operations.repository";
import { SupportOperationsService } from "./support-operations.service";
export const facilityWorkspaceRoutes: FastifyPluginAsync<{
  storage?: SupportImageStorage;
}> = async (app, options) => {
  const service = new FacilityRentalsService(new FacilityRentalsRepository(app.db));
  const support = new SupportOperationsService(
    new SupportOperationsRepository(app.db),
    options.storage,
  );
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.addHook("onRequest", async (_req, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
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
  const guards = [requireRole("FACILITY_MANAGER", "FACILITY_STAFF", "BUSINESS_OPERATION_MANAGER")];
  const params = z.object({ id: z.string().uuid() });
  typed.get(
    "/support",
    {
      preHandler: guards,
      schema: { tags: ["Support Operations"], querystring: FacilitySupportQuerySchema },
    },
    async (req) => successResponse(await support.list(actor(req.user), req.query)),
  );
  typed.get(
    "/support/:id",
    {
      preHandler: guards,
      schema: {
        tags: ["Support Operations"],
        params,
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(100).default(20),
          offset: z.coerce.number().int().nonnegative().default(0),
        }),
      },
    },
    async (req) =>
      successResponse(
        await support.detail(actor(req.user), req.params.id, req.query.limit, req.query.offset),
      ),
  );
  typed.post(
    "/support/:id/actions",
    {
      preHandler: guards,
      schema: { tags: ["Support Operations"], params, body: SupportOperationSchema },
    },
    async (req) => successResponse(await support.mutate(actor(req.user), req.params.id, req.body)),
  );
  typed.get(
    "/support/:id/images/:imageId",
    {
      preHandler: guards,
      schema: {
        tags: ["Support Operations"],
        params: params.extend({ imageId: z.string().uuid() }),
      },
    },
    async (req, reply) => {
      const image = await support.image(actor(req.user), req.params.id, req.params.imageId);
      return reply
        .type(image.mimeType)
        .header("X-Content-Type-Options", "nosniff")
        .send(Buffer.from(image.bytes));
    },
  );
};
function actor(user: { id: string } | null | undefined) {
  if (!user) throw new UnauthorizedError();
  return user.id;
}

export const supportWithdrawalRoutes: FastifyPluginAsync = async (app) => {
  const service = new SupportOperationsService(new SupportOperationsRepository(app.db));
  app.withTypeProvider<ZodTypeProvider>().post(
    "/tickets/:id/close",
    {
      preHandler: [requireRole("CUSTOMER")],
      schema: {
        tags: ["Support"],
        params: z.object({ id: z.string().uuid() }),
        body: z
          .object({
            version: z.number().int().nonnegative(),
            reason: z.string().trim().min(3, M.required).max(5000),
          })
          .strict(),
      },
    },
    async (req, reply) => {
      reply.header("Cache-Control", "private, no-store");
      return successResponse(await service.withdraw(actor(req.user), req.params.id, req.body));
    },
  );
};
