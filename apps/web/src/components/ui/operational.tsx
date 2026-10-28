import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { OPERATIONAL_LABELS } from "./operational.messages";
import type {
  OperationalBadgeProps,
  OperationalHeaderProps,
  OperationalSectionProps,
} from "./operational.types";

const tones = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  blue: "border-blue-200 bg-blue-50 text-blue-800",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  red: "border-rose-200 bg-rose-50 text-rose-800",
  gray: "border-slate-200 bg-slate-100 text-slate-600",
};
export function OperationalBadge({ value, label, tone }: OperationalBadgeProps) {
  const color =
    tone ??
    (["FAILED", "OVERDUE", "NO_SHOW"].includes(value)
      ? "red"
      : ["CANCELLED", "INACTIVE", "LOCKED", "CLOSED", "EXPIRED"].includes(value)
        ? "gray"
        : ["ACTIVE", "OCCUPIED", "IN_PROGRESS", "INSPECTING", "INSPECTION"].includes(value)
          ? "blue"
          : [
                "ASSIGNED",
                "AWAITING_APPROVAL",
                "OPEN",
                "PENDING",
                "RESERVED",
                "RETURN_PENDING",
                "MAINTENANCE",
                "REFUND_PENDING",
                "NEEDS_STAFF",
                "NEEDS_UNIT",
                "SLOT_MISSING",
                "ABANDONED_REVIEW",
                "TOO_EARLY",
                "PAYMENT_PENDING",
                "READY_HANDOVER",
              ].includes(value)
            ? "amber"
            : "green");
  return (
    <span
      className={cn(
        "inline-flex min-h-7 w-fit max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-tight",
        tones[color],
      )}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current opacity-75" />
      {label ?? OPERATIONAL_LABELS[value] ?? value}
    </span>
  );
}
export function OperationalPageHeader({
  title,
  description,
  eyebrow,
  action,
}: OperationalHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && (
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px] sm:leading-tight">
          {title}
        </h1>
        {description && <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}
export function OperationalSectionHeader({
  title,
  icon: Icon,
  count,
  description,
  action,
}: OperationalSectionProps) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-800">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-base font-bold text-slate-900">
            {title}
            {count !== undefined && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
                {count}
              </span>
            )}
          </h2>
          {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
export function OperationalBackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      {children}
    </Link>
  );
}
export const operationalToolbar =
  "flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs";
export const operationalField =
  "min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition-colors focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
