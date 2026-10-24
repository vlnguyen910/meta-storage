import {
  ConfirmRentalChargeRefundSchema,
  CreateRentalChargeSchema,
  RentalChargeAdjustmentSchema,
  RentalChargeDecisionSchema,
  RentalChargeDisputeSchema,
  RentalChargePageQuerySchema,
  RentalChargeParamsSchema,
  RentalChargeRefundParamsSchema,
  RentalChargeRentalParamsSchema,
  ResolveRentalChargeDisputeSchema,
  StartRentalChargePaymentSchema,
} from "@metastorage/contracts/rental-charges";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { createPaymentsService } from "../payments/payments.service";
import { RentalChargesRepository } from "./rental-charges.repository";
import { RentalChargesService } from "./rental-charges.service";

function actor(request: FastifyRequest) {
  if (!request.user?.role) throw new UnauthorizedError();
  return { id: request.user.id, role: request.user.role };
}

export const rentalChargesRoutes: FastifyPluginAsync = async (app) => {
  const service = new RentalChargesService(new RentalChargesRepository(app.db));
  const payments = createPaymentsService(app);
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/rental-charge-refunds",
    {
      preHandler: [requireRole("SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER")],
      schema: { querystring: RentalChargePageQuerySchema },
    },
    async (request) => successResponse(await service.listRefunds(actor(request), request.query)),
  );
  typed.post(
    "/rental-charge-refunds/:refundId/confirm",
    {
      preHandler: [requireRole("SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER")],
      schema: { params: RentalChargeRefundParamsSchema, body: ConfirmRentalChargeRefundSchema },
    },
    async (request) =>
      successResponse(
        await service.confirmRefund(actor(request), request.params.refundId, request.body),
      ),
  );
  typed.get(
    "/rentals/:rentalId/charges",
    { preHandler: [requireRole("CUSTOMER")], schema: { params: RentalChargeRentalParamsSchema } },
    async (request) =>
      successResponse(await service.listMine(actor(request), request.params.rentalId)),
  );
  typed.post(
    "/rentals/:rentalId/charges",
    {
      preHandler: [requireRole("FACILITY_STAFF")],
      schema: { params: RentalChargeRentalParamsSchema, body: CreateRentalChargeSchema },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          successResponse(
            await service.create(actor(request), request.params.rentalId, request.body),
          ),
        ),
  );
  typed.post(
    "/rental-charges/:chargeId/adjustments",
    {
      preHandler: [requireRole("BUSINESS_OPERATION_MANAGER")],
      schema: { params: RentalChargeParamsSchema, body: RentalChargeAdjustmentSchema },
    },
    async (request) =>
      successResponse(await service.adjust(actor(request), request.params.chargeId, request.body)),
  );
  typed.post(
    "/rental-charges/:chargeId/approve",
    {
      preHandler: [requireRole("FACILITY_MANAGER")],
      schema: { params: RentalChargeParamsSchema, body: RentalChargeDecisionSchema },
    },
    async (request) =>
      successResponse(
        await service.decide(actor(request), request.params.chargeId, request.body, true),
      ),
  );
  typed.post(
    "/rental-charges/:chargeId/reject",
    {
      preHandler: [requireRole("FACILITY_MANAGER")],
      schema: { params: RentalChargeParamsSchema, body: RentalChargeDecisionSchema },
    },
    async (request) =>
      successResponse(
        await service.decide(actor(request), request.params.chargeId, request.body, false),
      ),
  );
  typed.post(
    "/rental-charges/:chargeId/payments",
    {
      preHandler: [requireRole("CUSTOMER")],
      schema: { params: RentalChargeParamsSchema, body: StartRentalChargePaymentSchema },
    },
    async (request, reply) => {
      const current = actor(request);
      return reply
        .status(201)
        .send(
          successResponse(
            await payments.startRentalChargePayment(
              request.params.chargeId,
              current.id,
              request.body,
            ),
          ),
        );
    },
  );
  typed.post(
    "/rental-charges/:chargeId/dispute/resolve",
    {
      preHandler: [requireRole("FACILITY_MANAGER")],
      schema: { params: RentalChargeParamsSchema, body: ResolveRentalChargeDisputeSchema },
    },
    async (request) =>
      successResponse(
        await service.resolveDispute(actor(request), request.params.chargeId, request.body),
      ),
  );
  typed.post(
    "/rental-charges/:chargeId/dispute",
    {
      preHandler: [requireRole("CUSTOMER")],
      schema: { params: RentalChargeParamsSchema, body: RentalChargeDisputeSchema },
    },
    async (request) =>
      successResponse(await service.dispute(actor(request), request.params.chargeId, request.body)),
  );
};
