import { z } from "zod";
import { SUPPORT_MESSAGES as m } from "./support.messages";

export const SUPPORT_CATEGORIES = [
  "UNIT",
  "LOCK",
  "ACCESS_CODE",
  "STORED_ITEMS",
  "PAYMENT",
] as const;
export const SUPPORT_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;
export const SUPPORT_PRIORITIES = ["NORMAL", "HIGH"] as const;
export const SUPPORT_MESSAGE_KINDS = ["PUBLIC_REPLY", "INTERNAL_NOTE", "STAFF_REPORT"] as const;
export const SUPPORT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const SUPPORT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const SUPPORT_IMAGE_MAX_COUNT = 10;
export const SUPPORT_RESPONSE_HOURS = 12;

const key = z
  .string()
  .trim()
  .min(8, m.invalidKey)
  .max(128, m.invalidKey)
  .regex(/^[A-Za-z0-9._:-]+$/, m.invalidKey);
const content = z.string().trim().min(1, m.required).max(5000, m.contentLimit);
const uuid = z.string().uuid();
const time = z.string().datetime();
export const SupportTicketParamsSchema = z.strictObject({ ticketId: uuid });
export const SupportMessageParamsSchema = SupportTicketParamsSchema.extend({ messageId: uuid });
export const SupportAttachmentParamsSchema = SupportTicketParamsSchema.extend({
  attachmentId: uuid,
});
export const SupportCreateInputSchema = z.strictObject({
  bookingId: uuid,
  category: z.enum(SUPPORT_CATEGORIES),
  paymentId: uuid.optional(),
  subject: z.string().trim().min(1, m.required).max(200, m.subjectLimit),
  content,
  idempotencyKey: key,
});
export const SupportReplyInputSchema = z.strictObject({
  content,
  version: z.number().int().nonnegative(),
  idempotencyKey: key,
});
export const SupportImageInputSchema = z.strictObject({
  filename: z
    .string()
    .trim()
    .min(1, m.filename)
    .max(120, m.filename)
    .refine(
      (value) =>
        !/[\\/]/.test(value) &&
        [...value].every((char) => char.charCodeAt(0) > 31 && char.charCodeAt(0) !== 127),
      m.filename,
    ),
  mimeType: z.enum(SUPPORT_IMAGE_MIME_TYPES),
  dataBase64: z
    .string()
    .min(1, m.invalidImage)
    .max(Math.ceil(SUPPORT_IMAGE_MAX_BYTES / 3) * 4, m.invalidImage),
  version: z.number().int().nonnegative(),
  idempotencyKey: key,
});
export const SupportPageQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1, m.invalidCursor).max(768, m.invalidCursor).optional(),
});
export const SupportTicketQuerySchema = SupportPageQuerySchema.extend({
  bookingId: uuid.optional(),
  category: z.enum(SUPPORT_CATEGORIES).optional(),
  status: z.enum(SUPPORT_STATUSES).optional(),
});
export const SupportAttachmentSchema = z.object({
  id: uuid,
  ticketId: uuid,
  messageId: uuid,
  filename: z.string(),
  mimeType: z.enum(SUPPORT_IMAGE_MIME_TYPES),
  byteSize: z.number().int().positive(),
  createdAt: time,
});
export const SupportTicketSchema = z.object({
  id: uuid,
  bookingId: uuid,
  facilityId: uuid,
  rentalId: uuid.nullable(),
  storageUnitId: uuid.nullable(),
  paymentId: uuid.nullable(),
  category: z.enum(SUPPORT_CATEGORIES),
  subject: z.string(),
  status: z.enum(SUPPORT_STATUSES),
  priority: z.enum(SUPPORT_PRIORITIES),
  version: z.number().int().nonnegative(),
  actionDueAt: time,
  createdAt: time,
  updatedAt: time,
  closedAt: time.nullable(),
  closureKind: z.enum(["RESOLVED", "CUSTOMER_WITHDREW"]).nullable(),
  closeReason: z.string().nullable(),
});
export const SupportMessageSchema = z.object({
  id: uuid,
  ticketId: uuid,
  content: z.string(),
  authorName: z.string(),
  authorRole: z.string(),
  createdAt: time,
  attachments: z.array(SupportAttachmentSchema),
});
export const SupportTicketPageSchema = z.object({
  items: z.array(SupportTicketSchema),
  nextCursor: z.string().nullable(),
});
export const SupportMessagePageSchema = z.object({
  items: z.array(SupportMessageSchema),
  nextCursor: z.string().nullable(),
});
export const SupportDetailSchema = z.object({
  ticket: SupportTicketSchema,
  messages: SupportMessagePageSchema,
});
export const SupportReplyResultSchema = z.object({
  ticket: SupportTicketSchema,
  message: SupportMessageSchema,
});
export const SupportImageResultSchema = z.object({
  ticket: SupportTicketSchema,
  attachment: SupportAttachmentSchema,
});
export * from "./support.messages";
export type * from "./support.types";
