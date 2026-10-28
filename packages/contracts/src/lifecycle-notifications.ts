import { z } from "zod";

export {
  LifecycleNotificationEvent,
  NotificationDeliveryStatus,
} from "@metastorage/database/schema-domain";
export const NotificationInboxQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type NotificationInboxQuery = z.infer<typeof NotificationInboxQuerySchema>;
