import {
  SUPPORT_IMAGE_MAX_BYTES,
  SupportAttachmentParamsSchema,
  SupportContextParamsSchema,
  SupportContextQuerySchema,
  SupportCreateInputSchema,
  SupportDetailSchema,
  SupportImageInputSchema,
  SupportImageResultSchema,
  SupportMessagePageSchema,
  SupportMessageParamsSchema,
  SupportPageQuerySchema,
  SupportReplyInputSchema,
  SupportReplyResultSchema,
  SupportTicketPageSchema,
  SupportTicketParamsSchema,
  SupportTicketQuerySchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { SUPPORT_MESSAGES as m } from "./support.messages";
import { SupportRepository } from "./support.repository";
import { SupportService } from "./support.service";
import type { SupportRoutesOptions } from "./support.types";

const envelope = <T extends z.ZodType>(data: T) =>
  z.object({
    success: z.literal(true),
    data,
    timestamp: z.string().datetime(),
    message: z.string().optional(),
  });
function actor(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return request.user.id;
}
const schema = { tags: [m.tag], security: [{ sessionAuth: [] }] };

export const supportRoutes: FastifyPluginAsync<SupportRoutesOptions> = async (app, options) => {
  const service = new SupportService(
    options.repository ?? new SupportRepository(app.db),
    options.storage,
  );
  const typed = app.withTypeProvider<ZodTypeProvider>();
  app.addHook("onRequest", async (_req, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  const guards = [requireRole("CUSTOMER")];
  typed.get(
    "/contexts",
    { preHandler: guards, schema: { ...schema, querystring: SupportContextQuerySchema } },
    async (req) => successResponse(await service.contexts(actor(req), req.query)),
  );
  typed.get(
    "/contexts/:bookingId/payments",
    {
      preHandler: guards,
      schema: {
        ...schema,
        params: SupportContextParamsSchema,
        querystring: SupportPageQuerySchema,
      },
    },
    async (req) =>
      successResponse(await service.contextPayments(actor(req), req.params.bookingId, req.query)),
  );

  typed.post(
    "/tickets",
    {
      preHandler: guards,
      schema: {
        ...schema,
        summary: m.createSummary,
        body: SupportCreateInputSchema,
        response: { 201: envelope(SupportDetailSchema) },
      },
    },
    async (req, reply) =>
      reply.status(201).send(successResponse(await service.create(actor(req), req.body))),
  );
  typed.get(
    "/tickets",
    {
      preHandler: guards,
      schema: {
        ...schema,
        summary: m.listSummary,
        querystring: SupportTicketQuerySchema,
        response: { 200: envelope(SupportTicketPageSchema) },
      },
    },
    async (req) => successResponse(await service.list(actor(req), req.query)),
  );
  typed.get(
    "/tickets/:ticketId",
    {
      preHandler: guards,
      schema: {
        ...schema,
        summary: m.detailSummary,
        params: SupportTicketParamsSchema,
        response: { 200: envelope(SupportDetailSchema) },
      },
    },
    async (req) => successResponse(await service.detail(actor(req), req.params.ticketId)),
  );
  typed.get(
    "/tickets/:ticketId/messages",
    {
      preHandler: guards,
      schema: {
        ...schema,
        summary: m.messagesSummary,
        params: SupportTicketParamsSchema,
        querystring: SupportPageQuerySchema,
        response: { 200: envelope(SupportMessagePageSchema) },
      },
    },
    async (req) =>
      successResponse(await service.messages(actor(req), req.params.ticketId, req.query)),
  );
  typed.post(
    "/tickets/:ticketId/messages",
    {
      preHandler: guards,
      schema: {
        ...schema,
        summary: m.replySummary,
        params: SupportTicketParamsSchema,
        body: SupportReplyInputSchema,
        response: { 201: envelope(SupportReplyResultSchema) },
      },
    },
    async (req, reply) =>
      reply
        .status(201)
        .send(successResponse(await service.reply(actor(req), req.params.ticketId, req.body))),
  );
  typed.post(
    "/tickets/:ticketId/messages/:messageId/attachments",
    {
      preHandler: guards,
      bodyLimit: Math.ceil(SUPPORT_IMAGE_MAX_BYTES / 3) * 4 + 4096,
      schema: {
        ...schema,
        summary: m.uploadSummary,
        params: SupportMessageParamsSchema,
        body: SupportImageInputSchema,
        response: { 201: envelope(SupportImageResultSchema) },
      },
    },
    async (req, reply) =>
      reply
        .status(201)
        .send(
          successResponse(
            await service.upload(actor(req), req.params.ticketId, req.params.messageId, req.body),
          ),
        ),
  );
  typed.get(
    "/tickets/:ticketId/attachments/:attachmentId",
    {
      preHandler: guards,
      schema: { ...schema, summary: m.imageSummary, params: SupportAttachmentParamsSchema },
    },
    async (req, reply) => {
      const file = await service.image(actor(req), req.params.ticketId, req.params.attachmentId);
      return reply
        .type(file.attachment.mimeType)
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Security-Policy", "sandbox")
        .header(
          "Content-Disposition",
          `inline; filename*=UTF-8''${encodeURIComponent(file.attachment.originalFilename)}`,
        )
        .send(Buffer.from(file.bytes));
    },
  );
};
