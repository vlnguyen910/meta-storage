import type { LifecycleNotificationEvent } from "@metastorage/contracts";
import type { ReactNode } from "react";

export interface NotificationPopoverProps {
  href: string;
  hasUpdates?: boolean;
  children: (open: boolean) => ReactNode;
}

export interface NotificationDisplayItem {
  id: string;
  type: LifecycleNotificationEvent | "STAFF_TASK_ASSIGNED";
  subject: string;
  body: string;
  occurredAt: string;
  href?: string;
}

export interface NotificationListProps {
  items: readonly NotificationDisplayItem[];
  compact?: boolean;
}

export interface NotificationInboxProps {
  compact?: boolean;
}
