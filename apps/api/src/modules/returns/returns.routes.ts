import {
  AssignReturnStaffSchema,
  ConfigureOverdueRateSchema,
  ConfigureReturnChecklistSchema,
  ConfirmReturnRefundSchema,
  CreateReturnRequestSchema,
  DecideReturnTimeSchema,
  EditReturnRequestSchema,
  ProposeReturnTimeSchema,
  RecordPhysicalReturnSchema,
  ReturnDetailEnvelopeSchema,
  ReturnEvidenceInputSchema,
  ReturnEvidenceParamsSchema,
  ReturnInspectionParamsSchema,
  ReturnPhotoInputSchema,
  ReturnPhotoParamsSchema,
  ReturnPreviewEnvelopeSchema,
  ReturnPropertySchema,
  ReturnRefundEnvelopeSchema,
  ReturnRentalParamsSchema,
  ReturnRequestParamsSchema,
  ReturnSettlementEnvelopeSchema,
  ReturnSlotsQuerySchema,
  ReturnTimeChangeParamsSchema,
  ReturnVersionSchema,
  SaveReturnInspectionSchema,
  SettleReturnSchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireAuth, requireRole } from "../auth/auth.guard";
import { ReturnsRepository } from "./returns.repository";
import { ReturnsService } from "./returns.service";
import type { ReturnsRoutesOptions } from "./returns.types";

function actor(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return { id: request.user.id, role: request.user.role };
}

export const returnsRoutes: FastifyPluginAsync<ReturnsRoutesOptions> = async (app, options) => {
  const service = new ReturnsService(new ReturnsRepository(app.db), options.photoStorage);
  const typed = app.withTypeProvider<ZodTypeProvider>();
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  typed.get(
    "/rentals/:rentalId/return-requests",
    {
      preHandler: [requireAuth],
      schema: { params: ReturnRentalParamsSchema },
    },
    async (req) => successResponse(await service.list(actor(req), req.params.rentalId)),
  );
  typed.get(
    "/rentals/:rentalId/return-slots",
    {
      preHandler: [requireAuth],
      schema: { params: ReturnRentalParamsSchema, querystring: ReturnSlotsQuerySchema },
    },
    async (req) =>
      successResponse(await service.slots(actor(req), req.params.rentalId, req.query.date)),
  );
  typed.post(
    "/rentals/:rentalId/return-requests",
    {
      preHandler: [requireAuth],
      schema: { params: ReturnRentalParamsSchema, body: CreateReturnRequestSchema },
    },
    async (req, reply) =>
      reply
        .status(201)
        .send(successResponse(await service.create(actor(req), req.params.rentalId, req.body))),
  );
  typed.patch(
    "/return-requests/:requestId",
    {
      preHandler: [requireAuth],
      schema: { params: ReturnRequestParamsSchema, body: EditReturnRequestSchema },
    },
    async (req) => successResponse(await service.edit(actor(req), req.params.requestId, req.body)),
  );
  typed.post(
    "/return-requests/:requestId/cancel",
    {
      preHandler: [requireAuth],
      schema: { params: ReturnRequestParamsSchema, body: ReturnVersionSchema },
    },
    async (req) =>
      successResponse(
        await service.cancel(actor(req), req.params.requestId, req.body.expectedVersion),
      ),
  );
  typed.post(
    "/return-requests/:requestId/confirm",
    {
      preHandler: [requireAuth],
      schema: { params: ReturnRequestParamsSchema, body: ReturnVersionSchema },
    },
    async (req) =>
      successResponse(
        await service.confirm(actor(req), req.params.requestId, req.body.expectedVersion),
      ),
  );
  typed.get(
    "/return-policy/checklist",
    { preHandler: [requireRole("SYSTEM_ADMIN")] },
    async (req) => successResponse(await service.checklist(actor(req))),
  );
  typed.put(
    "/return-policy/checklist",
    {
      preHandler: [requireRole("SYSTEM_ADMIN")],
      schema: { body: ConfigureReturnChecklistSchema },
    },
    async (req) => successResponse(await service.configureChecklist(actor(req), req.body)),
  );
  typed.get(
    "/return-policy/overdue-rate",
    { preHandler: [requireRole("BUSINESS_OPERATION_MANAGER")] },
    async (req) => successResponse(await service.rate(actor(req))),
  );
  typed.put(
    "/return-policy/overdue-rate",
    {
      preHandler: [requireRole("BUSINESS_OPERATION_MANAGER")],
      schema: { body: ConfigureOverdueRateSchema },
    },
    async (req) => successResponse(await service.configureRate(actor(req), req.body)),
  );
  typed.get(
    "/return-requests/:requestId",
    {
      preHandler: [requireAuth],
      schema: { params: ReturnRequestParamsSchema, response: { 200: ReturnDetailEnvelopeSchema } },
    },
    async (req) => successResponse(await service.get(actor(req), req.params.requestId)),
  );
  typed.patch(
    "/return-requests/:requestId/staff",
    {
      preHandler: [requireAuth],
      schema: { params: ReturnRequestParamsSchema, body: AssignReturnStaffSchema },
    },
    async (req) =>
      successResponse(
        await service.assign(
          actor(req),
          req.params.requestId,
          req.body.expectedVersion,
          req.body.staffId,
          req.body.reason,
        ),
      ),
  );
  typed.post(
    "/return-requests/:requestId/inspections",
    {
      preHandler: [requireAuth],
      schema: { params: ReturnRequestParamsSchema, body: ReturnVersionSchema },
    },
    async (req, reply) =>
      reply
        .status(201)
        .send(
          successResponse(
            await service.startInspection(
              actor(req),
              req.params.requestId,
              req.body.expectedVersion,
            ),
          ),
        ),
  );
  typed.put(
    "/return-requests/:requestId/inspections/:inspectionId",
    {
      preHandler: [requireAuth],
      schema: { params: ReturnInspectionParamsSchema, body: SaveReturnInspectionSchema },
    },
    async (req) =>
      successResponse(
        await service.saveInspection(
          actor(req),
          req.params.requestId,
          req.params.inspectionId,
          req.body,
        ),
      ),
  );
  typed.post(
    "/return-requests/:requestId/inspections/:inspectionId/complete",
    {
      preHandler: [requireAuth],
      schema: { params: ReturnInspectionParamsSchema, body: ReturnVersionSchema },
    },
    async (req) =>
      successResponse(
        await service.completeInspection(
          actor(req),
          req.params.requestId,
          req.params.inspectionId,
          req.body.expectedVersion,
        ),
      ),
  );
  typed.put(
    "/return-requests/:requestId/inspections/:inspectionId/property",
    {
      preHandler: [requireAuth],
      schema: { params: ReturnInspectionParamsSchema, body: ReturnPropertySchema },
    },
    async (req) =>
      successResponse(
        await service.property(actor(req), req.params.requestId, req.params.inspectionId, req.body),
      ),
  );
  typed.post(
    "/return-requests/:requestId/inspections/:inspectionId/photos",
    {
      bodyLimit: 5 * 1024 * 1024,
      preHandler: [requireAuth],
      schema: { params: ReturnInspectionParamsSchema, body: ReturnPhotoInputSchema },
    },
    async (req, reply) =>
      reply
        .status(201)
        .send(
          successResponse(
            await service.uploadPhoto(
              actor(req),
              req.params.requestId,
              req.params.inspectionId,
              req.body,
            ),
          ),
        ),
  );
  typed.get(
    "/return-requests/:requestId/inspections/:inspectionId/photos/:photoId",
    {
      preHandler: [requireAuth],
      schema: { params: ReturnPhotoParamsSchema },
    },
    async (req) =>
      successResponse(
        await service.photo(
          actor(req),
          req.params.requestId,
          req.params.inspectionId,
          req.params.photoId,
        ),
      ),
  );
  typed.post(
    "/return-requests/:requestId/physical-return",
    {
      preHandler: [requireAuth],
      schema: { params: ReturnRequestParamsSchema, body: RecordPhysicalReturnSchema },
    },
    async (req) =>
      successResponse(
        await service.recordReceipt(
          actor(req),
          req.params.requestId,
          req.body.expectedVersion,
          req.body.actualReturnAt,
          req.body.reason,
        ),
      ),
  );
  typed.post(
    "/return-requests/:requestId/evidence",
    {
      bodyLimit: 5 * 1024 * 1024,
      preHandler: [requireAuth],
      schema: { params: ReturnRequestParamsSchema, body: ReturnEvidenceInputSchema },
    },
    async (req, reply) =>
      reply
        .status(201)
        .send(
          successResponse(await service.uploadEvidence(actor(req), req.params.requestId, req.body)),
        ),
  );
  typed.get(
    "/return-requests/:requestId/evidence/:photoId",
    {
      preHandler: [requireAuth],
      schema: { params: ReturnEvidenceParamsSchema },
    },
    async (req) =>
      successResponse(
        await service.evidencePhoto(actor(req), req.params.requestId, req.params.photoId),
      ),
  );
  typed.post(
    "/return-requests/:requestId/time-changes",
    {
      preHandler: [requireAuth],
      schema: { params: ReturnRequestParamsSchema, body: ProposeReturnTimeSchema },
    },
    async (req, reply) =>
      reply
        .status(201)
        .send(
          successResponse(await service.proposeTime(actor(req), req.params.requestId, req.body)),
        ),
  );
  typed.post(
    "/return-requests/:requestId/time-changes/:changeId/decision",
    {
      preHandler: [requireAuth],
      schema: { params: ReturnTimeChangeParamsSchema, body: DecideReturnTimeSchema },
    },
    async (req) =>
      successResponse(
        await service.decideTime(
          actor(req),
          req.params.requestId,
          req.params.changeId,
          req.body.expectedVersion,
          req.body.approve,
          req.body.reason,
        ),
      ),
  );
  typed.post(
    "/return-requests/:requestId/settlement/preview",
    {
      preHandler: [requireAuth],
      schema: {
        params: ReturnRequestParamsSchema,
        body: SettleReturnSchema,
        response: { 200: ReturnPreviewEnvelopeSchema },
      },
    },
    async (req) =>
      successResponse(await service.preview(actor(req), req.params.requestId, req.body)),
  );
  typed.post(
    "/return-requests/:requestId/settlement",
    {
      preHandler: [requireAuth],
      schema: {
        params: ReturnRequestParamsSchema,
        body: SettleReturnSchema,
        response: { 200: ReturnSettlementEnvelopeSchema },
      },
    },
    async (req) =>
      successResponse(await service.settle(actor(req), req.params.requestId, req.body)),
  );
  typed.post(
    "/return-requests/:requestId/refunds/confirm",
    {
      preHandler: [requireAuth],
      schema: {
        params: ReturnRequestParamsSchema,
        body: ConfirmReturnRefundSchema,
        response: { 200: ReturnRefundEnvelopeSchema },
      },
    },
    async (req) =>
      successResponse(await service.confirmRefund(actor(req), req.params.requestId, req.body)),
  );
};
