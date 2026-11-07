"use client";

import type { StaffTaskAssignedNotification } from "@metastorage/contracts";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { facilityStaffRoutes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import { NotificationList } from "./notification-list";
import { NOTIFICATIONS as M } from "./notifications.messages";
import type { NotificationInboxProps } from "./notifications.types";

export function StaffNotificationList({ compact = false }: NotificationInboxProps) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: events } = useQuery<StaffTaskAssignedNotification[]>({
    queryKey: ["bookings", "notification-events", userId],
    queryFn: () => [],
    initialData: [],
    enabled: false,
    gcTime: Number.POSITIVE_INFINITY,
  });
  const items = (compact ? events.slice(0, 8) : events).map((event) => ({
    ...event,
    subject: M.staffSubject,
    body: M.staffBody,
    href: `${facilityStaffRoutes.dashboard}?view=tasks`,
  }));
  return (
    <>
      {!compact && (
        <p className="m-0 border-b border-slate-100 px-5 py-4 text-sm leading-6 text-slate-600">
          {M.sessionOnly}
        </p>
      )}
      {items.length ? (
        <NotificationList items={items} compact={compact} />
      ) : (
        <div className="px-5 py-10 text-center">
          <Bell size={26} className="mx-auto mb-3 text-slate-400" aria-hidden="true" />
          <p className="m-0 text-sm font-bold text-slate-900">{M.staffEmpty}</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">{M.sessionOnly}</p>
        </div>
      )}
      {!compact && events.length === 100 && (
        <p className="px-5 py-4 text-xs text-slate-500">{M.sessionLimit}</p>
      )}
    </>
  );
}
