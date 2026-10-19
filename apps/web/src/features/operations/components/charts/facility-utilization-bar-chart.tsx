"use client";

import type { ReportFacility, ReportInventoryMetrics } from "@metastorage/contracts";
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
import { OPERATIONS_MESSAGES as M } from "../../operations.messages";
import { formatPercentage } from "../../operations.utils";

export interface FacilityUtilizationBarChartProps {
  items: { facility: ReportFacility; metrics: ReportInventoryMetrics }[];
  totalFacilities: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: {
    payload: {
      facility: ReportFacility;
      metrics: ReportInventoryMetrics;
      percent: number;
      isNull: boolean;
    };
  }[];
}

function UtilizationBarTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length || !payload[0]) return null;
  const { facility, metrics, isNull, percent } = payload[0].payload;

  return (
    <div
      role="tooltip"
      className="min-w-52 rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-white shadow-xl"
    >
      <p className="border-b border-slate-700 pb-1.5 font-bold text-slate-100">
        {facility.name} ({facility.code})
      </p>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
        <span className="text-slate-400">Tỷ lệ sử dụng:</span>
        <span className="text-right font-bold text-emerald-400">
          {isNull ? M.noOperatingUnitsBadge : formatPercentage(percent)}
        </span>

        <span className="text-slate-400">Đang sử dụng:</span>
        <span className="text-right font-semibold text-white">{metrics.occupiedUnits} ô</span>

        <span className="text-slate-400">Tổng ô khai thác:</span>
        <span className="text-right font-semibold text-slate-300">{metrics.activeUnits} ô</span>

        <span className="text-slate-400">Còn trống:</span>
        <span className="text-right font-semibold text-sky-300">{metrics.availableUnits} ô</span>

        <span className="text-slate-400">Đang bảo trì:</span>
        <span className="text-right font-semibold text-amber-300">
          {metrics.maintenanceUnits} ô
        </span>

        <span className="text-slate-400">Ngừng hoạt động:</span>
        <span className="text-right font-semibold text-slate-400">{metrics.inactiveUnits} ô</span>
      </div>
    </div>
  );
}

export function FacilityUtilizationBarChart({
  items,
  totalFacilities,
}: Readonly<FacilityUtilizationBarChartProps>) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = items.map(({ facility, metrics }) => {
    const isNull = metrics.utilizationPercent === null;
    const percent = metrics.utilizationPercent ?? 0;

    return {
      name: facility.name,
      code: facility.code,
      percent,
      isNull,
      facility,
      metrics,
    };
  });

  const chartHeight = Math.max(items.length * 44 + 60, 220);

  return (
    <section className="grid gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h3 className="text-base font-bold text-ink">{M.titles.utilization} theo cơ sở</h3>
          <p className="m-0 text-xs text-slate-600">
            Tỷ lệ sử dụng tính trên tổng ô khai thác của từng cơ sở
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {M.showingFacilitiesCount(items.length, totalFacilities)}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{M.empty}</p>
      ) : !mounted ? (
        <div
          style={{ height: chartHeight }}
          className="w-full animate-pulse rounded-lg bg-slate-50"
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
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 12, fill: "#1e293b", fontWeight: 500 }}
              />
              <Tooltip content={<UtilizationBarTooltip />} />
              <Bar dataKey="percent" name="Tỷ lệ sử dụng" radius={[0, 4, 4, 0]} barSize={18}>
                {chartData.map((entry) => (
                  <Cell key={`cell-${entry.code}`} fill={entry.isNull ? "#cbd5e1" : "#165f4d"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
