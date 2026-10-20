"use client";

import { cn } from "@/lib/cn";
import { OPERATIONS_MESSAGES as M } from "../../operations.messages";
import { formatPercentage } from "../../operations.utils";
import type { FacilityUtilizationChartProps } from "./facility-utilization-chart.types";

export function FacilityUtilizationChart({
  items,
  totalFacilities,
}: Readonly<FacilityUtilizationChartProps>) {
  // Sort ascending by utilization rate so underutilized facilities are at top
  const sortedItems = [...items].sort((a, b) => {
    if (a.metrics.utilizationPercent === null && b.metrics.utilizationPercent === null) return 0;
    if (a.metrics.utilizationPercent === null) return -1;
    if (b.metrics.utilizationPercent === null) return 1;
    return a.metrics.utilizationPercent - b.metrics.utilizationPercent;
  });

  return (
    <section className="grid gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h3 className="text-base font-bold text-ink">{M.facilityUtilizationChartTitle}</h3>
          <p className="m-0 text-xs text-slate-600">{M.facilityUtilizationChartDesc}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {M.showingFacilitiesCount(sortedItems.length, totalFacilities)}
        </span>
      </div>

      {sortedItems.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{M.empty}</p>
      ) : (
        <div className="grid gap-3 pt-2">
          {sortedItems.map(({ facility, metrics }) => {
            const percent = metrics.utilizationPercent;
            const isNull = percent === null;

            return (
              <div
                key={facility.id}
                className="group relative rounded-lg p-2.5 transition-colors hover:bg-slate-50/70 focus-within:bg-slate-50/70"
              >
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-semibold text-ink">{facility.name}</span>
                  <span className="tabular-nums">
                    {isNull ? (
                      <span className="rounded-xs bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                        {M.noOperatingUnitsBadge}
                      </span>
                    ) : (
                      <strong
                        className={cn(
                          percent < 40
                            ? "text-amber-700"
                            : percent >= 80
                              ? "text-emerald-700"
                              : "text-primary",
                        )}
                      >
                        {formatPercentage(percent)} ({metrics.occupiedUnits}/{metrics.activeUnits}{" "}
                        ô)
                      </strong>
                    )}
                  </span>
                </div>

                {isNull ? (
                  <div className="h-3.5 w-full rounded-full bg-slate-100 border border-dashed border-slate-300" />
                ) : (
                  <div className="h-3.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        percent < 40
                          ? "bg-amber-500"
                          : percent >= 80
                            ? "bg-emerald-600"
                            : "bg-primary",
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                    />
                  </div>
                )}

                {/* Popover Tooltip */}
                <div
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden min-w-48 -translate-x-1/2 rounded-md bg-slate-900 p-2.5 text-xs text-white shadow-lg whitespace-nowrap group-hover:block group-focus-within:block"
                >
                  <p className="font-bold border-b border-slate-700 pb-1 mb-1">
                    {facility.name} ({facility.code})
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums">
                    <span>Đang sử dụng:</span>
                    <span className="font-semibold text-right">{metrics.occupiedUnits} ô</span>
                    <span>Tổng ô khai thác:</span>
                    <span className="font-semibold text-right">{metrics.activeUnits} ô</span>
                    <span>Còn trống:</span>
                    <span className="font-semibold text-emerald-300 text-right">
                      {metrics.availableUnits} ô
                    </span>
                    <span>Bảo trì:</span>
                    <span className="font-semibold text-amber-300 text-right">
                      {metrics.maintenanceUnits} ô
                    </span>
                    <span>Tỷ lệ sử dụng:</span>
                    <span className="font-bold text-sky-300 text-right">
                      {isNull ? M.noOperatingUnitsBadge : formatPercentage(percent)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
