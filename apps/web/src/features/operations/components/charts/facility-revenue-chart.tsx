"use client";

import type { ReportFacility, ReportFinancialMetrics } from "@metastorage/contracts";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { OPERATIONS_MESSAGES as M } from "../../operations.messages";
import { formatMoney } from "../../operations.utils";

export interface FacilityRevenueChartProps {
  items: { facility: ReportFacility; metrics: ReportFinancialMetrics }[];
  totalFacilities: number;
}

export function FacilityRevenueChart({
  items,
  totalFacilities,
}: Readonly<FacilityRevenueChartProps>) {
  const [viewMode, setViewMode] = useState<"rentalOnly" | "cashVsRefund">("rentalOnly");

  // Compute max value for scaling
  const maxVal = Math.max(
    ...items.flatMap((item) => {
      const received = Number.parseFloat(item.metrics.cashReceived) || 0;
      const rental = Number.parseFloat(item.metrics.rentalCollected ?? "0") || 0;
      const refunded = Number.parseFloat(item.metrics.cashRefunded) || 0;
      return viewMode === "rentalOnly" ? [rental] : [received, refunded];
    }),
    1,
  );

  return (
    <section className="grid gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h3 className="text-base font-bold text-ink">{M.titles.revenue}</h3>
          <p className="m-0 text-xs text-slate-600">
            {M.showingFacilitiesCount(items.length, totalFacilities)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-outline-variant bg-slate-50 p-1">
            <button
              type="button"
              aria-pressed={viewMode === "rentalOnly"}
              onClick={() => setViewMode("rentalOnly")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                viewMode === "rentalOnly"
                  ? "bg-white text-primary shadow-xs"
                  : "text-slate-600 hover:text-ink",
              )}
            >
              {M.chartRentalOnly}
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "cashVsRefund"}
              onClick={() => setViewMode("cashVsRefund")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                viewMode === "cashVsRefund"
                  ? "bg-white text-primary shadow-xs"
                  : "text-slate-600 hover:text-ink",
              )}
            >
              {M.chartCashVsRefund}
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
        {viewMode === "rentalOnly" ? (
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-primary" aria-hidden="true" />
            <span>{M.chartRentalCollectedLegend}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-primary" aria-hidden="true" />
              <span>{M.chartCashReceivedLegend}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-rose-500" aria-hidden="true" />
              <span>{M.chartCashRefundedLegend}</span>
            </div>
          </>
        )}
      </div>

      {/* Chart Bars */}
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{M.empty}</p>
      ) : (
        <div className="grid gap-3 pt-2">
          {items.map(({ facility, metrics }) => {
            const rentalVal = Number.parseFloat(metrics.rentalCollected ?? "0") || 0;
            const receivedVal = Number.parseFloat(metrics.cashReceived) || 0;
            const refundedVal = Number.parseFloat(metrics.cashRefunded) || 0;

            const rentalPercent = Math.min(100, Math.max(0, (rentalVal / maxVal) * 100));
            const receivedPercent = Math.min(100, Math.max(0, (receivedVal / maxVal) * 100));
            const refundedPercent = Math.min(100, Math.max(0, (refundedVal / maxVal) * 100));

            return (
              <div
                key={facility.id}
                className="group relative rounded-lg p-2.5 transition-colors hover:bg-slate-50/70 focus-within:bg-slate-50/70"
              >
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-semibold text-ink">{facility.name}</span>
                  <span className="tabular-nums text-slate-600">
                    {viewMode === "rentalOnly"
                      ? metrics.rentalCollected !== null
                        ? formatMoney(metrics.rentalCollected)
                        : M.dataNeedsReconciliation
                      : `${formatMoney(metrics.cashReceived)} / ${formatMoney(metrics.cashRefunded)}`}
                  </span>
                </div>

                {viewMode === "rentalOnly" ? (
                  <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${rentalPercent}%` }}
                    />
                  </div>
                ) : (
                  <div className="grid gap-1">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${receivedPercent}%` }}
                      />
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-rose-500 transition-all duration-300"
                        style={{ width: `${refundedPercent}%` }}
                      />
                    </div>
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
                    <span>Thực thu:</span>
                    <span className="font-semibold text-right">
                      {formatMoney(metrics.cashReceived)}
                    </span>
                    <span>Tiền thuê:</span>
                    <span className="font-semibold text-right">
                      {formatMoney(metrics.rentalCollected)}
                    </span>
                    <span>Tiền cọc:</span>
                    <span className="font-semibold text-right">
                      {formatMoney(metrics.depositCollected)}
                    </span>
                    <span>Đã hoàn:</span>
                    <span className="font-semibold text-rose-300 text-right">
                      {formatMoney(metrics.cashRefunded)}
                    </span>
                    <span>Dòng tiền ròng:</span>
                    <span className="font-bold text-sky-300 text-right">
                      {formatMoney(metrics.netCash)}
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
