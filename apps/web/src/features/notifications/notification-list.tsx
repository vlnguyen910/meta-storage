"use client";

import {
  Bell,
  CalendarClock,
  Check,
  ClipboardList,
  CreditCard,
  LifeBuoy,
  PackageCheck,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { NOTIFICATIONS as M } from "./notifications.messages";
import type { NotificationListProps } from "./notifications.types";

export function NotificationList({ items, compact = false }: NotificationListProps) {
  const now = Date.now();
  const relative = (date: string) => {
    const seconds = Math.max(0, (now - Date.parse(date)) / 1000);
    if (seconds < 60) return M.now;
    const [value, unit] =
      seconds < 3600
        ? ([seconds / 60, "minute"] as const)
        : seconds < 86400
          ? ([seconds / 3600, "hour"] as const)
          : ([seconds / 86400, "day"] as const);
    return new Intl.RelativeTimeFormat("vi", { numeric: "auto" }).format(-Math.floor(value), unit);
  };
  return (
    <ul className={cn("m-0 list-none p-0", compact ? "space-y-1" : "divide-y divide-slate-100")}>
      {items.map((item) => {
        const Icon =
          item.type === "STAFF_TASK_ASSIGNED"
            ? ClipboardList
            : item.type === "SUPPORT_CREATED"
              ? LifeBuoy
              : item.type === "PAYMENT_CONFIRMED"
                ? CreditCard
                : item.type === "BOOKING_CONFIRMED"
                  ? Check
                  : item.type === "RETURN_REFUND"
                    ? RotateCcw
                    : item.type.startsWith("RETURN_")
                      ? PackageCheck
                      : item.type === "UPCOMING_EXPIRY" || item.type === "RENTAL_OVERDUE"
                        ? CalendarClock
                        : Bell;
        const content = (
          <>
            <span
              className={cn(
                "mt-0.5 grid shrink-0 place-items-center rounded-full",
                compact ? "size-11" : "size-12",
                item.type === "RENTAL_OVERDUE"
                  ? "bg-amber-50 text-amber-800"
                  : item.type.startsWith("RETURN_")
                    ? "bg-sky-50 text-sky-800"
                    : "bg-emerald-50 text-emerald-800",
              )}
            >
              <Icon size={compact ? 20 : 22} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "m-0 break-words text-sm font-bold leading-5 text-slate-900 [overflow-wrap:anywhere]",
                  compact && "line-clamp-2",
                )}
              >
                {item.subject}
              </p>
              <p
                className={cn(
                  "m-0 mt-1 break-words text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]",
                  compact ? "line-clamp-2" : "whitespace-pre-wrap",
                )}
              >
                {item.body}
              </p>
              <time
                dateTime={item.occurredAt}
                title={new Date(item.occurredAt).toLocaleString("vi-VN")}
                className="mt-1.5 block text-xs font-medium text-slate-500"
              >
                {compact
                  ? relative(item.occurredAt)
                  : new Date(item.occurredAt).toLocaleString("vi-VN")}
              </time>
            </div>
          </>
        );
        return (
          <li key={item.id}>
            {item.href ? (
              <Link
                href={item.href}
                className="flex gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-primary"
              >
                {content}
              </Link>
            ) : (
              <article
                className={cn(
                  "flex gap-3",
                  compact ? "rounded-xl p-3 hover:bg-slate-50" : "px-5 py-5 sm:px-6",
                )}
              >
                {content}
              </article>
            )}
          </li>
        );
      })}
    </ul>
  );
}
