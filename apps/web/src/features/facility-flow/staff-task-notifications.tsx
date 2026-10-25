"use client";

import { Circle, LoaderCircle, WifiOff } from "lucide-react";
import Link from "next/link";
import { facilityStaffRoutes } from "@/config/routes";
import { NotificationPopover } from "@/features/notifications/notification-popover";
import { NOTIFICATIONS as N } from "@/features/notifications/notifications.messages";
import { StaffNotificationList } from "@/features/notifications/staff-notification-list";
import { STAFF_NOTIFICATIONS as M } from "./staff-task-notifications.messages";
import { useStaffTaskNotifications } from "./use-staff-task-notifications";

export function StaffTaskNotifications() {
  const { enabled, status, received, reconnect } = useStaffTaskNotifications();
  if (!enabled) return null;
  const Icon =
    status === "connecting" || status === "reconnecting"
      ? LoaderCircle
      : status === "offline" || status === "unavailable"
        ? WifiOff
        : Circle;
  return (
    <NotificationPopover href={facilityStaffRoutes.notifications} hasUpdates={received}>
      {() => (
        <>
          <div className="mx-3 mb-2 rounded-xl bg-slate-50 px-3 py-3">
            <p
              role="status"
              className="m-0 flex items-start gap-2 text-xs leading-5 text-slate-600"
            >
              <Icon
                size={14}
                aria-hidden="true"
                className={`mt-0.5 shrink-0 ${status === "connected" ? "fill-emerald-600 text-emerald-600" : ""}`}
              />
              {M[status]}
            </p>
            {(status === "unavailable" || status === "reconnecting") && (
              <button
                type="button"
                onClick={reconnect}
                className="mt-2 min-h-11 rounded-lg bg-white px-3 text-xs font-bold text-primary ring-1 ring-slate-200 focus-visible:outline-2 focus-visible:outline-primary"
              >
                {M.retry}
              </button>
            )}
          </div>
          <StaffNotificationList compact />
          <Link
            href={`${facilityStaffRoutes.dashboard}?view=tasks`}
            className="mx-3 mb-2 flex min-h-11 items-center justify-center rounded-xl bg-slate-50 px-3 text-xs font-bold text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary"
          >
            {N.staffTasks}
          </Link>
        </>
      )}
    </NotificationPopover>
  );
}
