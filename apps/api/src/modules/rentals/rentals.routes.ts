import { RentalIdParamsSchema, RentalPageQuerySchema } from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { RentalsRepository } from "./rentals.repository";
import { RentalsService } from "./rentals.service";

export const rentalsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new RentalsService(new RentalsRepository(fastify.db));
  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/mine",
    { schema: { querystring: RentalPageQuerySchema }, preHandler: [requireRole("CUSTOMER")] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(successResponse(await service.pageMine(request.user.id, request.query)));
    },
  );

  typedApp.get(
    "/:rentalId/payments",
    { schema: { params: RentalIdParamsSchema }, preHandler: [requireRole("CUSTOMER")] },
    async (request, reply) => {
      reply.header("Cache-Control", "private, no-store");
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(await service.paymentsMine(request.params.rentalId, request.user.id)),
      );
    },
  );

  typedApp.get(
    "/:rentalId",
    { schema: { params: RentalIdParamsSchema }, preHandler: [requireRole("CUSTOMER")] },
    async (request, reply) => {
      if (!request.user) throw new UnauthorizedError();
      return reply.send(
        successResponse(await service.getMine(request.params.rentalId, request.user.id)),
      );
    },
  );
};
