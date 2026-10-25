"use client";

import { ArrowLeft, Bell } from "lucide-react";
import Link from "next/link";
import { facilityStaffRoutes } from "@/config/routes";
import { NOTIFICATIONS as M } from "@/features/notifications/notifications.messages";
import { StaffNotificationList } from "@/features/notifications/staff-notification-list";

export function StaffNotificationsScreen() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 py-6 [--color-muted:#475569]">
      <Link
        href={`${facilityStaffRoutes.dashboard}?view=tasks`}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-primary"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {M.staffTasks}
      </Link>
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Bell size={24} aria-hidden="true" />
        </span>
        <h1 className="m-0 text-3xl font-extrabold tracking-tight text-slate-900">{M.title}</h1>
      </div>
      <section
        aria-label={M.all}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <StaffNotificationList />
      </section>
    </div>
  );
}
