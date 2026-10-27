"use client";

import { UserRole } from "@metastorage/contracts";
import { customerRoutes, facilityManagerRoutes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import { NotificationInbox } from "@/features/notifications/notification-inbox";
import { NotificationPopover } from "@/features/notifications/notification-popover";

export function LifecycleInbox() {
  const role = useAuthStore((state) => state.session?.user.role);
  const href =
    role === UserRole.FACILITY_MANAGER
      ? facilityManagerRoutes.notifications
      : customerRoutes.notifications;
  return (
    <NotificationPopover href={href}>{() => <NotificationInbox compact />}</NotificationPopover>
  );
}
