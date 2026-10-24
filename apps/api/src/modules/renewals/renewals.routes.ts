import {
  AcceptRenewalSchema,
  QuoteRenewalSchema,
  RenewalPageQuerySchema,
  RenewalParamsSchema,
  RenewalRentalParamsSchema,
} from "@metastorage/contracts/renewals";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { RenewalsRepository } from "./renewals.repository";
import { RenewalsService } from "./renewals.service";

function customerId(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return request.user.id;
}

export const renewalsRoutes: FastifyPluginAsync = async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const service = new RenewalsService(new RenewalsRepository(app.db));
  typed.addHook("preHandler", requireRole("CUSTOMER"));
  typed.post(
    "/rentals/:rentalId/renewals",
    { schema: { tags: ["Renewals"], params: RenewalRentalParamsSchema, body: QuoteRenewalSchema } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          successResponse(
            await service.quote(request.params.rentalId, customerId(request), request.body),
          ),
        ),
  );
  typed.get(
    "/rentals/:rentalId/renewals",
    {
      schema: {
        tags: ["Renewals"],
        params: RenewalRentalParamsSchema,
        querystring: RenewalPageQuerySchema,
      },
    },
    async (request) =>
      successResponse(
        await service.list(request.params.rentalId, customerId(request), request.query),
      ),
  );
  typed.get(
    "/rental-renewals/:renewalId",
    { schema: { tags: ["Renewals"], params: RenewalParamsSchema } },
    async (request) =>
      successResponse(await service.get(request.params.renewalId, customerId(request))),
  );
  typed.post(
    "/rental-renewals/:renewalId/accept",
    { schema: { tags: ["Renewals"], params: RenewalParamsSchema, body: AcceptRenewalSchema } },
    async (request) =>
      successResponse(
        await service.accept(request.params.renewalId, customerId(request), request.body),
      ),
  );
};
