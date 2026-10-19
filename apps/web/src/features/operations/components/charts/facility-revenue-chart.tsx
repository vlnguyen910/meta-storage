"use client";

import type { ReportFacility, ReportFinancialMetrics } from "@metastorage/contracts";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { OPERATIONS_MESSAGES as M } from "../../operations.messages";
import { formatMoney } from "../../operations.utils";

export interface FacilityRevenueChartProps {
  items: { facility: ReportFacility; metrics: ReportFinancialMetrics }[];
  totalFacilities: number;
  limit?: number;
  showFullReportLink?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: {
    dataKey: string;
    name: string;
    value: number;
    color: string;
    payload: {
      facility: ReportFacility;
      metrics: ReportFinancialMetrics;
    };
  }[];
}

function RevenueChartTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length || !payload[0]) return null;
  const item = payload[0].payload;
  const { facility, metrics } = item;

  return (
    <div
      role="tooltip"
      className="min-w-56 rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-white shadow-xl"
    >
      <p className="border-b border-slate-700 pb-1.5 font-bold text-slate-100">
        {facility.name} ({facility.code})
      </p>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
        <span className="text-slate-400">Tiền thuê đã thu:</span>
        <span className="text-right font-semibold text-emerald-400">
          {metrics.rentalCollected !== null
            ? formatMoney(metrics.rentalCollected)
            : M.dataNeedsReconciliation}
        </span>

        <span className="text-slate-400">Thực thu (gồm cọc):</span>
        <span className="text-right font-semibold text-white">
          {formatMoney(metrics.cashReceived)}
        </span>

        <span className="text-slate-400">Tiền cọc đã thu:</span>
        <span className="text-right font-semibold text-slate-300">
          {formatMoney(metrics.depositCollected)}
        </span>

        <span className="text-slate-400">Tiền đã hoàn:</span>
        <span className="text-right font-semibold text-rose-400">
          {formatMoney(metrics.cashRefunded)}
        </span>

        <span className="text-slate-400 border-t border-slate-800 pt-1 font-medium">
          Dòng tiền ròng:
        </span>
        <span
          className={cn(
            "text-right border-t border-slate-800 pt-1 font-bold",
            Number.parseFloat(metrics.netCash) < 0 ? "text-rose-400" : "text-sky-300",
          )}
        >
          {formatMoney(metrics.netCash)}
        </span>
      </div>
    </div>
  );
}

export function FacilityRevenueChart({
  items,
  totalFacilities,
  limit,
  showFullReportLink = false,
}: Readonly<FacilityRevenueChartProps>) {
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<"rentalOnly" | "cashVsRefund">("rentalOnly");

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayItems = limit ? items.slice(0, limit) : items;

  const chartData = displayItems.map(({ facility, metrics }) => {
    const rentalVal =
      metrics.rentalCollected !== null ? Number.parseFloat(metrics.rentalCollected) || 0 : 0;
    const receivedVal = Number.parseFloat(metrics.cashReceived) || 0;
    const refundedVal = Number.parseFloat(metrics.cashRefunded) || 0;

    return {
      name: facility.name,
      code: facility.code,
      rentalVal,
      receivedVal,
      refundedVal,
      isRentalNull: metrics.rentalCollected === null,
      facility,
      metrics,
    };
  });

  const chartHeight = Math.max(displayItems.length * 52 + 60, 220);

  return (
    <section className="grid gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h3 className="text-base font-bold text-ink">
            {limit ? "Doanh thu theo cơ sở (Xem trước)" : M.titles.revenue}
          </h3>
          <p className="m-0 text-xs text-slate-600">
            {M.showingFacilitiesCount(displayItems.length, totalFacilities)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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

          {showFullReportLink && (
            <Link
              href={routes.revenue}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <span>Xem báo cáo đầy đủ</span>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      {/* Chart Canvas */}
      {displayItems.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{M.empty}</p>
      ) : !mounted ? (
        <div
          style={{ height: chartHeight }}
          className="w-full animate-pulse bg-slate-50 rounded-lg"
        />
      ) : (
        <div style={{ height: chartHeight, width: "100%" }} className="min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis
                type="number"
                tickFormatter={(val) => {
                  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)} tỷ`;
                  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)} tr`;
                  return `${val}`;
                }}
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 12, fill: "#1e293b", fontWeight: 500 }}
              />
              <Tooltip content={<RevenueChartTooltip />} />

              {viewMode === "rentalOnly" ? (
                <Bar
                  dataKey="rentalVal"
                  name={M.chartRentalCollectedLegend}
                  fill="#165f4d"
                  radius={[0, 4, 4, 0]}
                  barSize={18}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={`cell-${entry.code}`}
                      fill={entry.isRentalNull ? "#e2e8f0" : "#165f4d"}
                    />
                  ))}
                </Bar>
              ) : (
                <>
                  <Bar
                    dataKey="receivedVal"
                    name={M.chartCashReceivedLegend}
                    fill="#165f4d"
                    radius={[0, 4, 4, 0]}
                    barSize={12}
                  />
                  <Bar
                    dataKey="refundedVal"
                    name={M.chartCashRefundedLegend}
                    fill="#ef4444"
                    radius={[0, 4, 4, 0]}
                    barSize={12}
                  />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
