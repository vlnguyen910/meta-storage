"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { OPERATIONS_MESSAGES as M } from "../../operations.messages";
import { formatPercentage } from "../../operations.utils";
import type { FacilityUtilizationDonutChartProps } from "./facility-utilization-donut-chart.types";

export function FacilityUtilizationDonutChart({
  metrics,
  compact = false,
}: Readonly<FacilityUtilizationDonutChartProps>) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isNull = metrics.utilizationPercent === null;
  const occupied = metrics.occupiedUnits;
  const active = metrics.activeUnits;
  const unrented = Math.max(0, active - occupied);

  const data = [
    { name: "Đang sử dụng", value: occupied, color: "#165f4d" },
    {
      name: "Chưa thuê trong tổng ô khai thác",
      value: unrented,
      color: "#e2e8f0",
    },
  ];

  const chartBody = isNull ? (
    <div
      className={`flex ${compact ? "h-36 sm:h-40" : "h-52"} flex-col items-center justify-center rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-4 text-center`}
    >
      <span className="rounded-md border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
        {M.noOperatingUnitsBadge}
      </span>
      <p className="mt-1.5 max-w-xs text-xs text-amber-800">
        Hệ thống chưa ghi nhận ô kho hoạt động nào tại phạm vi đã chọn.
      </p>
    </div>
  ) : !mounted ? (
    <div
      className={`${compact ? "h-36 sm:h-40" : "h-52"} w-full animate-pulse rounded-lg bg-slate-50`}
    />
  ) : (
    <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2">
      {/* Donut Chart */}
      <div className={`relative ${compact ? "h-36 sm:h-40" : "h-52"} w-full`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={compact ? 42 : 55}
              outerRadius={compact ? 62 : 75}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={`cell-${entry.name}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(val, name) => [`${val} ô`, name]}
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center rate */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`${compact ? "text-xl" : "text-2xl"} font-bold tabular-nums text-slate-900`}
          >
            {formatPercentage(metrics.utilizationPercent ?? 0)}
          </span>
          <span className="text-[11px] font-medium text-slate-500">Khai thác</span>
        </div>
      </div>

      {/* Legend and breakdown */}
      <div className="space-y-2 text-xs">
        <div className="flex items-start gap-2">
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-xs bg-[#165f4d]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">Đang sử dụng: {occupied} ô</p>
            <p className="text-[11px] text-slate-500">Đã bàn giao cho khách thuê</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-xs bg-slate-300" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-700">Chưa thuê: {unrented} ô</p>
            <p className="text-[11px] text-slate-500">
              {metrics.availableUnits} trống, {metrics.maintenanceUnits} bảo trì
            </p>
          </div>
        </div>

        <div className="rounded-md bg-slate-50 p-2 text-[11px] text-slate-600 border border-slate-100">
          <span className="font-semibold text-slate-700">Mẫu số: </span>
          {active} ô khai thác (đã trừ {metrics.inactiveUnits} ô ngừng HĐ)
        </div>
      </div>
    </div>
  );

  if (compact) {
    return <div className="min-w-0">{chartBody}</div>;
  }

  return (
    <section className="grid gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h3 className="text-base font-bold text-ink">Tỷ lệ khai thác hiện tại</h3>
          <p className="m-0 text-xs text-slate-600">
            Ô đang thuê / ô khai thác (loại trừ ngừng hoạt động)
          </p>
        </div>
        <Link
          href={routes.utilization}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <span>Xem báo cáo đầy đủ</span>
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      {chartBody}
    </section>
  );
}
