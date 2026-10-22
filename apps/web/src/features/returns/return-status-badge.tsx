import { returnStatusLabel } from "./returns.messages";

export function ReturnStatusBadge({ status }: { status: string }) {
  const config =
    status === "COMPLETED"
      ? { tone: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" }
      : status === "FAILED"
        ? { tone: "border-rose-200 bg-rose-50 text-rose-800", dot: "bg-rose-500" }
        : status === "CANCELLED"
          ? { tone: "border-slate-200 bg-slate-100 text-slate-700", dot: "bg-slate-400" }
          : status === "INSPECTING"
            ? { tone: "border-teal-200 bg-teal-50 text-teal-800", dot: "bg-teal-500 animate-pulse" }
            : status === "CONFIRMED"
              ? { tone: "border-sky-200 bg-sky-50 text-sky-800", dot: "bg-sky-500" }
              : { tone: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" };

  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold shadow-2xs ${config.tone}`}
    >
      <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${config.dot}`} />
      <span>{returnStatusLabel(status)}</span>
    </span>
  );
}
