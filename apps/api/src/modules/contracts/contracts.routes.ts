import {
  ContractBookingParamsSchema,
  ContractDocumentParamsSchema,
  ContractDownloadQuerySchema,
  ContractIssueSchema,
  ContractRentalParamsSchema,
  ContractUploadSchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireAuth } from "../auth/auth.guard";
import { ContractsRepository } from "./contracts.repository";
import { ContractsService } from "./contracts.service";
import type { ContractsRoutesOptions } from "./contracts.types";

function actor(req: FastifyRequest) {
  if (!req.user) throw new UnauthorizedError();
  return { id: req.user.id, role: req.user.role };
}
export const contractsRoutes: FastifyPluginAsync<ContractsRoutesOptions> = async (app, options) => {
  const service = new ContractsService(new ContractsRepository(app.db), options.storage),
    typed = app.withTypeProvider<ZodTypeProvider>();
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  typed.get(
    "/bookings/:bookingId/contracts",
    { preHandler: [requireAuth], schema: { params: ContractBookingParamsSchema } },
    async (req) => successResponse(await service.list(actor(req), req.params.bookingId)),
  );
  typed.get(
    "/rentals/:rentalId/contracts",
    { preHandler: [requireAuth], schema: { params: ContractRentalParamsSchema } },
    async (req) => successResponse(await service.rental(actor(req), req.params.rentalId)),
  );
  typed.post(
    "/bookings/:bookingId/contracts",
    {
      preHandler: [requireAuth],
      bodyLimit: 28 * 1024 * 1024,
      schema: { params: ContractBookingParamsSchema, body: ContractUploadSchema },
    },
    async (req, reply) =>
      reply
        .status(201)
        .send(successResponse(await service.upload(actor(req), req.params.bookingId, req.body))),
  );
  typed.post(
    "/bookings/:bookingId/contracts/:contractId/issue",
    {
      preHandler: [requireAuth],
      schema: { params: ContractDocumentParamsSchema, body: ContractIssueSchema },
    },
    async (req) =>
      successResponse(
        await service.issue(actor(req), req.params.bookingId, req.params.contractId, req.body),
      ),
  );
  typed.get(
    "/bookings/:bookingId/contracts/:contractId/pdf",
    {
      preHandler: [requireAuth],
      schema: { params: ContractDocumentParamsSchema, querystring: ContractDownloadQuerySchema },
    },
    async (req, reply) => {
      const file = await service.file(actor(req), req.params.bookingId, req.params.contractId);
      return reply
        .type("application/pdf")
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Security-Policy", "sandbox")
        .header(
          "Content-Disposition",
          `${req.query.download === "true" ? "attachment" : "inline"}; filename="contract-${file.id}.pdf"`,
        )
        .send(Buffer.from(file.bytes));
    },
  );
};
