import { LOADING_MESSAGES } from "@/components/ui/loading.messages";

export function ChartLoadingSkeleton() {
  return (
    <section
      className="grid min-h-[330px] content-start gap-4 rounded-card border border-outline-variant bg-white p-5 shadow-soft"
      role="status"
      aria-label={LOADING_MESSAGES.chart}
      aria-busy="true"
    >
      <div aria-hidden="true" className="grid gap-3">
        <div className="h-5 w-1/2 animate-pulse rounded bg-slate-200/75" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
        <div className="mt-2 h-64 animate-pulse rounded-lg bg-slate-100" />
      </div>
      <span className="sr-only">{LOADING_MESSAGES.chart}</span>
    </section>
  );
}
