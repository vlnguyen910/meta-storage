import { z } from "zod";

export const LifecycleNotificationEvent = [
  "PAYMENT_CONFIRMED",
  "BOOKING_CONFIRMED",
  "UPCOMING_EXPIRY",
  "RENTAL_OVERDUE",
  "ABANDONED_REVIEW",
  "RETURN_SCHEDULED",
  "RETURN_CHANGED",
  "RETURN_INSPECTION",
  "RETURN_SETTLED",
  "RETURN_REFUND",
  "RETURN_TIME_CHANGED",
] as const;
export type LifecycleNotificationEvent = (typeof LifecycleNotificationEvent)[number];
export const NotificationDeliveryStatus = [
  "PENDING",
  "PROCESSING",
  "SENT",
  "REVIEW_REQUIRED",
  "SUPPRESSED",
] as const;
export const NotificationInboxQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type NotificationInboxQuery = z.infer<typeof NotificationInboxQuerySchema>;
