import {
  BookingTrackingParamsSchema,
  CreateReturnRequestSchema,
  GuestContractDownloadQuerySchema,
  GuestContractParamsSchema,
  RequestGuestAccessLinkSchema,
  ReturnSlotsQuerySchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { successResponse } from "../../common/response/api-response";
import {
  privateTrackingResponse,
  requireTrackingOrigin,
  trackingSessionToken,
} from "../bookings/bookings.access";
import { ReturnsRepository } from "../returns/returns.repository";
import { ReturnsService } from "../returns/returns.service";
import { GuestRentalAccessRepository } from "./guest-rental-access.repository";
import { GuestRentalAccessService } from "./guest-rental-access.service";

export const guestRentalAccessRoutes: FastifyPluginAsync = async (app) => {
  const service = new GuestRentalAccessService(
    new GuestRentalAccessRepository(app.db),
    app.redis,
    app.redisService,
    new ReturnsService(new ReturnsRepository(app.db)),
  );
  const typed = app.withTypeProvider<ZodTypeProvider>();
  app.addHook("onRequest", privateTrackingResponse);

  typed.get(
    "/booking/tracking/:bookingCode/return-requests",
    { schema: { params: BookingTrackingParamsSchema } },
    async (request) =>
      successResponse(
        await service.returnRequests(request.params.bookingCode, trackingSessionToken(request)),
      ),
  );
  typed.get(
    "/booking/tracking/:bookingCode/return-slots",
    { schema: { params: BookingTrackingParamsSchema, querystring: ReturnSlotsQuerySchema } },
    async (request) =>
      successResponse(
        await service.returnSlots(
          request.params.bookingCode,
          request.query.date,
          trackingSessionToken(request),
        ),
      ),
  );
  typed.post(
    "/booking/tracking/:bookingCode/return-requests",
    {
      onRequest: [requireTrackingOrigin],
      schema: { params: BookingTrackingParamsSchema, body: CreateReturnRequestSchema },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          successResponse(
            await service.createReturn(
              request.params.bookingCode,
              request.body,
              trackingSessionToken(request),
            ),
          ),
        ),
  );

  typed.post(
    "/booking/access-link",
    {
      onRequest: [requireTrackingOrigin],
      schema: { body: RequestGuestAccessLinkSchema },
    },
    async (request, reply) =>
      reply.status(202).send(successResponse(await service.requestLink(request.body, request.ip))),
  );

  typed.get(
    "/booking/tracking/:bookingCode/rental",
    { schema: { params: BookingTrackingParamsSchema } },
    async (request) =>
      successResponse(
        await service.rental(request.params.bookingCode, trackingSessionToken(request)),
      ),
  );
  typed.get(
    "/booking/tracking/:bookingCode/payments",
    { schema: { params: BookingTrackingParamsSchema } },
    async (request) =>
      successResponse(
        await service.payments(request.params.bookingCode, trackingSessionToken(request)),
      ),
  );
  typed.get(
    "/booking/tracking/:bookingCode/contracts",
    { schema: { params: BookingTrackingParamsSchema } },
    async (request) =>
      successResponse(
        await service.contracts(request.params.bookingCode, trackingSessionToken(request)),
      ),
  );
  typed.get(
    "/booking/tracking/:bookingCode/contracts/:contractId/pdf",
    {
      schema: {
        params: GuestContractParamsSchema,
        querystring: GuestContractDownloadQuerySchema,
      },
    },
    async (request, reply) => {
      const file = await service.contractPdf(
        request.params.bookingCode,
        request.params.contractId,
        trackingSessionToken(request),
      );
      return reply
        .type("application/pdf")
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Security-Policy", "sandbox")
        .header(
          "Content-Disposition",
          `${request.query.download === "true" ? "attachment" : "inline"}; filename="contract-${file.id}.pdf"`,
        )
        .send(Buffer.from(file.bytes));
    },
  );
};
