import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { RentalsRepository } from "./rentals.repository";
import { RentalsService } from "./rentals.service";

const rentalIdParamsSchema = z.object({ rentalId: z.string().uuid() });

export const rentalsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new RentalsService(new RentalsRepository(fastify.db));
  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

  typedApp.get("/mine", { preHandler: [requireRole("CUSTOMER")] }, async (request, reply) => {
    if (!request.user) throw new UnauthorizedError();
    return reply.send(successResponse(await service.listMine(request.user.id)));
  });

  typedApp.get(
    "/:rentalId",
    { schema: { params: rentalIdParamsSchema }, preHandler: [requireRole("CUSTOMER")] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(await service.getMine(request.params.rentalId, request.user.id)),
      );
    },
  );
};
