"use client";

import Link from "next/link";
import { STAFF_NOTIFICATIONS as M } from "./staff-task-notifications.messages";
import { useStaffTaskNotifications } from "./use-staff-task-notifications";

export function StaffTaskNotifications() {
  const { enabled, status, received, reconnect } = useStaffTaskNotifications();
  if (!enabled) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#bfc9c4] bg-white p-3 text-sm text-[#003b2f] print:hidden">
      <p>{M[status]}</p>
      <div className="flex flex-wrap items-center gap-3">
        {received && (
          <Link href="/staff/dashboard" className="underline underline-offset-4">
            {M.viewTasks}
          </Link>
        )}
        {(status === "unavailable" || status === "reconnecting") && (
          <button
            type="button"
            onClick={reconnect}
            className="min-h-11 rounded border border-[#003b2f] px-3 font-semibold"
          >
            {M.retry}
          </button>
        )}
      </div>
    </div>
  );
}
