import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { OPERATIONAL_LABELS } from "./operational.messages";
import type { OperationalBadgeProps, OperationalHeaderProps } from "./operational.types";

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
    <header className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
        {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </header>
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
