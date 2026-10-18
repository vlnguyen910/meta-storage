"use client";

import type { ReportInventoryMetrics } from "@metastorage/contracts";
import { cn } from "@/lib/cn";
import { OPERATIONS_MESSAGES as M } from "../../operations.messages";
import { formatPercentage } from "../../operations.utils";

export interface InventoryStatusChartProps {
  metrics: ReportInventoryMetrics;
  title?: string;
}

export function InventoryStatusChart({
  metrics,
  title = M.inventoryStatusTitle,
}: Readonly<InventoryStatusChartProps>) {
  const totalPhysical = metrics.totalUnits || 1;

  const statuses = [
    {
      key: "occupied",
      label: M.statusOccupied,
      count: metrics.occupiedUnits,
      color: "bg-blue-600",
      textColor: "text-blue-700",
      bgLight: "bg-blue-50",
    },
    {
      key: "available",
      label: M.statusAvailable,
      count: metrics.availableUnits,
      color: "bg-emerald-500",
      textColor: "text-emerald-700",
      bgLight: "bg-emerald-50",
    },
    {
      key: "maintenance",
      label: M.statusMaintenance,
      count: metrics.maintenanceUnits,
      color: "bg-amber-500",
      textColor: "text-amber-700",
      bgLight: "bg-amber-50",
    },
    {
      key: "reserved",
      label: M.statusReserved,
      count: metrics.reservedUnits,
      color: "bg-indigo-500",
      textColor: "text-indigo-700",
      bgLight: "bg-indigo-50",
    },
    {
      key: "inspection",
      label: M.statusInspection,
      count: metrics.inspectionUnits,
      color: "bg-purple-500",
      textColor: "text-purple-700",
      bgLight: "bg-purple-50",
    },
    {
      key: "returnPending",
      label: M.statusReturnPending,
      count: metrics.returnPendingUnits,
      color: "bg-orange-500",
      textColor: "text-orange-700",
      bgLight: "bg-orange-50",
    },
    {
      key: "locked",
      label: M.statusLocked,
      count: metrics.lockedUnits,
      color: "bg-slate-500",
      textColor: "text-slate-700",
      bgLight: "bg-slate-100",
    },
    {
      key: "inactive",
      label: M.statusInactive,
      count: metrics.inactiveUnits,
      color: "bg-zinc-400",
      textColor: "text-zinc-600",
      bgLight: "bg-zinc-100",
    },
  ];

  return (
    <section className="grid gap-5 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-3">
        <div>
          <h3 className="text-base font-bold text-ink">{title}</h3>
          <p className="m-0 text-xs text-slate-600">{M.inventoryFormulaNoteReal}</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500">Tỷ lệ khai thác: </span>
          <strong className="text-sm font-bold text-primary">
            {metrics.utilizationPercent !== null
              ? formatPercentage(metrics.utilizationPercent)
              : M.noOperatingUnitsBadge}
          </strong>
        </div>
      </div>

      {/* Stacked Segmented Bar */}
      <div className="grid gap-2">
        <div
          role="img"
          aria-label={`Biểu đồ trạng thái: ${statuses.map((s) => `${s.label}: ${s.count}`).join(", ")}`}
          className="flex h-5 w-full overflow-hidden rounded-full bg-slate-100"
        >
          {statuses.map((s) => {
            if (s.count === 0) return null;
            const percent = (s.count / totalPhysical) * 100;
            return (
              <div
                key={s.key}
                title={`${s.label}: ${s.count} ô (${formatPercentage(percent)})`}
                className={cn("h-full transition-all duration-300", s.color)}
                style={{ width: `${percent}%` }}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 pt-2">
          {statuses.map((s) => (
            <div
              key={s.key}
              className={cn("flex items-center justify-between rounded-md p-2", s.bgLight)}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={cn("h-2.5 w-2.5 shrink-0 rounded-full", s.color)}
                  aria-hidden="true"
                />
                <span className="truncate text-slate-700 font-medium">{s.label.split(" ")[0]}</span>
              </div>
              <strong className={cn("tabular-nums shrink-0 ml-1 font-bold", s.textColor)}>
                {s.count}
              </strong>
            </div>
          ))}
        </div>
      </div>

      {/* Non-physical Flow Metrics Callout */}
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3.5 text-xs text-indigo-950">
        <p className="font-semibold text-indigo-900 mb-1">
          {M.nonPhysicalTitle} —{" "}
          <span className="font-normal text-indigo-700">{M.nonPhysicalNote}</span>
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
          <div className="flex items-center justify-between rounded-md bg-white p-2 border border-indigo-100">
            <span>{M.activeHoldsLabel}:</span>
            <strong className="font-bold tabular-nums text-indigo-700">
              {metrics.activeCheckoutHolds} lượt giữ chỗ
            </strong>
          </div>
          <div className="flex items-center justify-between rounded-md bg-white p-2 border border-indigo-100">
            <span>{M.awaitingHandoverLabel}:</span>
            <strong className="font-bold tabular-nums text-indigo-700">
              {metrics.confirmedAwaitingHandover} booking
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}
