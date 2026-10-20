import type { LifecycleNotificationEvent } from "@metastorage/contracts";
import type { Database } from "@metastorage/database";

export type NotificationTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export interface LifecycleEventInput {
  key: string;
  type: LifecycleNotificationEvent;
  bookingId: string;
  detail?: string;
  managers?: boolean;
  customer?: boolean;
  occurredAt?: Date;
}
