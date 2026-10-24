"use client";

import { Bell, CheckCircle2, CircleAlert, LoaderCircle, WifiOff } from "lucide-react";
import Link from "next/link";
import { STAFF_NOTIFICATIONS as M } from "./staff-task-notifications.messages";
import { useStaffTaskNotifications } from "./use-staff-task-notifications";

export function StaffTaskNotifications() {
  const { enabled, status, received, reconnect } = useStaffTaskNotifications();
  if (!enabled) return null;
  const tone =
    status === "connected"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : received
        ? "border-sky-200 bg-sky-50 text-sky-950"
        : status === "offline" || status === "unavailable"
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-slate-200 bg-white text-slate-900";
  const Icon =
    status === "connected"
      ? CheckCircle2
      : status === "offline"
        ? WifiOff
        : status === "unavailable"
          ? CircleAlert
          : received
            ? Bell
            : LoaderCircle;
  return (
    <section
      aria-label={M.notifications}
      className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 text-sm shadow-sm print:hidden ${tone}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/80">
          <Icon
            size={18}
            className={status === "connecting" || status === "reconnecting" ? "animate-spin" : ""}
            aria-hidden="true"
          />
        </span>
        <div className="min-w-0">
          <strong className="block text-xs font-bold uppercase tracking-wide">
            {M.notifications}
          </strong>
          <p className="m-0 mt-0.5 leading-5">{M[status]}</p>
        </div>
      </div>
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
            className="min-h-11 rounded-lg border border-current bg-white/70 px-3 font-semibold transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {M.retry}
          </button>
        )}
      </div>
    </section>
  );
}
