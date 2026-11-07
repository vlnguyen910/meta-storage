"use client";

import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { OPERATIONS_MESSAGES as M } from "../../operations.messages";
import type { InventoryStatusChartProps } from "./inventory-status-chart.types";

export function InventoryStatusChart({
  metrics,
  title = M.inventoryStatusTitle,
}: Readonly<InventoryStatusChartProps>) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const physicalSegments = [
    {
      name: "Đang sử dụng (Occupied)",
      value: metrics.occupiedUnits,
      color: "#165f4d",
      description: "Đang được khách hàng sử dụng thực tế",
    },
    {
      name: "Còn trống (Available)",
      value: metrics.availableUnits,
      color: "#10b981",
      description: "Sẵn sàng bàn giao cho hợp đồng mới",
    },
    {
      name: "Đang bảo trì (Maintenance)",
      value: metrics.maintenanceUnits,
      color: "#f59e0b",
      description: "Đang sửa chữa hoặc bảo dưỡng kỹ thuật",
    },
    {
      name: "Chờ bàn giao (Reserved)",
      value: metrics.reservedUnits,
      color: "#6366f1",
      description: "Đã gán ô kho vật lý, chờ khách nhận",
    },
    {
      name: "Đang kiểm tra (Inspection)",
      value: metrics.inspectionUnits,
      color: "#06b6d4",
      description: "Nhân viên đang kiểm tra hiện trạng",
    },
    {
      name: "Chờ trả kho (Return pending)",
      value: metrics.returnPendingUnits,
      color: "#ec4899",
      description: "Hết hạn thuê, đang tiến hành trả kho",
    },
    {
      name: "Đang khóa (Locked)",
      value: metrics.lockedUnits,
      color: "#64748b",
      description: "Tạm khóa do sự cố hoặc tranh chấp",
    },
    {
      name: "Ngừng hoạt động (Inactive)",
      value: metrics.inactiveUnits,
      color: "#94a3b8",
      description: "Không đưa vào mẫu số tính tỷ lệ khai thác",
    },
  ];

  const activeSegments = physicalSegments.filter((seg) => seg.value > 0);

  return (
    <section className="grid gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <p className="m-0 text-xs text-slate-500 mt-0.5">{M.inventoryFormulaNoteReal}</p>
      </div>

      {/* Physical Status Donut Chart & Legend */}
      <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-12">
        <div data-testid="inventory-donut-chart" className="relative h-52 w-full sm:col-span-5">
          {!mounted ? (
            <div className="h-full w-full animate-pulse rounded-lg bg-slate-50" />
          ) : activeSegments.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">
              Không có dữ liệu ô kho
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activeSegments}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {activeSegments.map((entry) => (
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
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold tabular-nums text-slate-900">
                  {metrics.totalUnits}
                </span>
                <span className="text-[11px] font-medium text-slate-500">Tổng số ô</span>
              </div>
            </>
          )}
        </div>

        {/* Detailed Full Labels Legend */}
        <div className="grid grid-cols-1 gap-1.5 sm:col-span-7">
          {physicalSegments.map((seg) => (
            <div
              key={seg.name}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-2 py-1 text-xs"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="size-2.5 shrink-0 rounded-xs"
                  style={{ backgroundColor: seg.color }}
                  aria-hidden="true"
                />
                <span className="truncate text-slate-700 font-medium text-[11px]">{seg.name}</span>
              </div>
              <span className="font-bold font-mono tabular-nums text-slate-800 ml-2 text-xs shrink-0">
                {seg.value} ô
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Non-physical Indicators Section */}
      <div className="border-t border-slate-100 pt-3">
        <h4 className="text-xs font-bold text-slate-700 mb-1.5">{M.nonPhysicalTitle}</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50/50 p-2.5">
            <div className="min-w-0">
              <span className="text-xs font-semibold text-sky-900 block truncate">
                {M.activeHoldsLabel}
              </span>
              <p className="m-0 text-[10px] text-sky-700 truncate">Giữ chỗ checkout</p>
            </div>
            <strong className="text-base font-bold tabular-nums text-sky-900 ml-2 shrink-0">
              {metrics.activeCheckoutHolds}
            </strong>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50/50 p-2.5">
            <div className="min-w-0">
              <span className="text-xs font-semibold text-indigo-900 block truncate">
                {M.awaitingHandoverLabel}
              </span>
              <p className="m-0 text-[10px] text-indigo-700 truncate">Chờ lịch nhận kho</p>
            </div>
            <strong className="text-base font-bold tabular-nums text-indigo-900 ml-2 shrink-0">
              {metrics.confirmedAwaitingHandover}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}
