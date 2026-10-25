"use client";

import { ArrowLeft, Bell } from "lucide-react";
import Link from "next/link";
import { roleHome } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import { NotificationInbox } from "./notification-inbox";
import { NOTIFICATIONS as M } from "./notifications.messages";

export function NotificationCenter() {
  const role = useAuthStore((state) => state.session?.user.role);
  return (
    <div className="mx-auto max-w-3xl space-y-5 py-6 [--color-muted:#475569]">
      {role && (
        <Link
          href={roleHome[role]}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {M.back}
        </Link>
      )}
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Bell size={24} aria-hidden="true" />
        </span>
        <div>
          <h1 className="m-0 text-3xl font-extrabold tracking-tight text-slate-900">{M.title}</h1>
          <p className="mb-0 mt-2 text-sm leading-6 text-slate-600">{M.description}</p>
        </div>
      </div>
      <section
        aria-label={M.all}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <NotificationInbox />
      </section>
    </div>
  );
}
