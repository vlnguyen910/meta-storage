import { LOADING_MESSAGES } from "@/components/ui/loading.messages";
import { cn } from "@/lib/cn";

function ChartSkeletonBlock({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-lg bg-slate-200/70",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer",
        "before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent",
        className,
      )}
    />
  );
}

export function ChartLoadingSkeleton() {
  return (
    <section
      className="grid min-h-[330px] content-start gap-4 rounded-card border border-outline-variant/70 bg-white p-6 shadow-xs"
      role="status"
      aria-label={LOADING_MESSAGES.chart}
      aria-busy="true"
    >
      <div aria-hidden="true" className="grid gap-4">
        <div className="flex items-center justify-between border-b border-line/80 pb-3">
          <div className="space-y-1.5">
            <ChartSkeletonBlock className="h-4 w-44" />
            <ChartSkeletonBlock className="h-3 w-64" />
          </div>
          <ChartSkeletonBlock className="h-8 w-24 rounded-lg" />
        </div>

        {/* Realistic bar chart silhouette */}
        <div className="mt-2 flex h-56 items-end justify-between gap-3 pt-4">
          <ChartSkeletonBlock className="h-[40%] w-full rounded-t-md" />
          <ChartSkeletonBlock className="h-[65%] w-full rounded-t-md" />
          <ChartSkeletonBlock className="h-[85%] w-full rounded-t-md" />
          <ChartSkeletonBlock className="h-[50%] w-full rounded-t-md" />
          <ChartSkeletonBlock className="h-[75%] w-full rounded-t-md" />
          <ChartSkeletonBlock className="h-[90%] w-full rounded-t-md" />
          <ChartSkeletonBlock className="h-[60%] w-full rounded-t-md" />
          <ChartSkeletonBlock className="h-[80%] w-full rounded-t-md" />
        </div>

        <div className="flex justify-between border-t border-line/60 pt-2">
          <ChartSkeletonBlock className="h-2.5 w-12" />
          <ChartSkeletonBlock className="h-2.5 w-12" />
          <ChartSkeletonBlock className="h-2.5 w-12" />
          <ChartSkeletonBlock className="h-2.5 w-12" />
        </div>
      </div>
      <span className="sr-only">{LOADING_MESSAGES.chart}</span>
    </section>
  );
}
