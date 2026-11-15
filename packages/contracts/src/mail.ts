import { z } from "zod";

export const MAIL_QUEUE_NAME = "mail";
export const AUTH_MAIL_TTL_SECONDS = 60 * 60;

export enum MailJobKind {
  BOOKING_CONFIRMATION = "BOOKING_CONFIRMATION",
  // Keep the wire value so the consumer can explicitly reject retired jobs.
  BOOKING_TRACKING_LINK = "BOOKING_TRACKING_LINK",
  NOTIFICATION = "NOTIFICATION",
  VERIFY_EMAIL = "VERIFY_EMAIL",
  RESET_PASSWORD = "RESET_PASSWORD",
}

const httpUrl = z.url({ protocol: /^https?$/ });
const deliveryId = z.string().min(1);
const expiresAt = z.iso.datetime({ offset: true });

export const BookingConfirmationEmailInputSchema = z.object({
  deliveryId,
  trackingUrl: httpUrl,
  recipientEmail: z.email(),
  bookingCode: z.string().nullable(),
  facilityName: z.string(),
  unitTypeName: z.string(),
  qrUrl: httpUrl,
});
export type BookingConfirmationEmailInput = z.infer<typeof BookingConfirmationEmailInputSchema>;

export const AuthMailInputSchema = z.object({
  kind: z.union([z.literal(MailJobKind.VERIFY_EMAIL), z.literal(MailJobKind.RESET_PASSWORD)]),
  recipientEmail: z.email(),
  name: z.string(),
  url: httpUrl,
});
export type AuthMailInput = z.infer<typeof AuthMailInputSchema>;

export const AuthMailPayloadSchema = AuthMailInputSchema.extend({ deliveryId, expiresAt });
export type AuthMailPayload = z.infer<typeof AuthMailPayloadSchema>;

export const BookingMailJobDataSchema = z.object({
  kind: z.union([
    z.literal(MailJobKind.BOOKING_CONFIRMATION),
    z.literal(MailJobKind.BOOKING_TRACKING_LINK),
  ]),
  deliveryId,
  payload: z.string().min(1),
  expiresAt,
});
export type BookingMailJobData = z.infer<typeof BookingMailJobDataSchema>;

// Redis only carries the durable reference; notification content stays in PostgreSQL.
export const NotificationMailJobDataSchema = z.object({
  kind: z.literal(MailJobKind.NOTIFICATION),
  outboxId: z.uuid(),
});
export type NotificationMailJobData = z.infer<typeof NotificationMailJobDataSchema>;

export const AuthMailJobDataSchema = z.object({
  kind: AuthMailInputSchema.shape.kind,
  deliveryId,
  payload: z.string().min(1),
  expiresAt,
});
export type AuthMailJobData = z.infer<typeof AuthMailJobDataSchema>;

export const MailJobDataSchema = z.discriminatedUnion("kind", [
  BookingMailJobDataSchema,
  NotificationMailJobDataSchema,
  AuthMailJobDataSchema,
]);
export type MailJobData = z.infer<typeof MailJobDataSchema>;
