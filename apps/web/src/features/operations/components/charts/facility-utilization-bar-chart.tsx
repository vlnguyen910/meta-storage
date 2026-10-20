"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { OPERATIONS_MESSAGES as M } from "../../operations.messages";
import { formatPercentage } from "../../operations.utils";
import { REPORTING_MESSAGES as R } from "../../operations-reporting.messages";
import type { FacilityUtilizationBarChartProps } from "./operations-chart.types";
export function FacilityUtilizationBarChart({
  items,
  totalFacilities,
}: Readonly<FacilityUtilizationBarChartProps>) {
  const data = items.map((item) => ({
    ...item,
    code:
      item.facility.code.length > 12 ? `${item.facility.code.slice(0, 10)}…` : item.facility.code,
    percent: item.metrics.utilizationPercent,
  }));
  return (
    <section className="min-w-0 rounded-card border border-outline-variant bg-white p-5">
      <h2 className="text-base font-bold">{R.utilization}</h2>
      <p className="mt-1 text-xs text-slate-600">{R.utilizationHelp}</p>
      <p className="text-xs text-slate-500">
        {M.showingFacilitiesCount(items.length, totalFacilities)}
      </p>
      {items.length === 0 ? (
        <p>{R.empty}</p>
      ) : (
        <div className="mt-4 h-72 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} accessibilityLayer margin={{ bottom: 15, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="code"
                interval={0}
                angle={-25}
                textAnchor="end"
                tick={{ fontSize: 10 }}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                width={45}
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <div className="rounded border bg-white p-3 text-xs shadow">
                      <strong>{payload[0].payload.facility.name}</strong>
                      <p>
                        {payload[0].payload.metrics.utilizationPercent === null
                          ? R.zeroInventory
                          : formatPercentage(payload[0].payload.metrics.utilizationPercent)}
                      </p>
                      <p>
                        {payload[0].payload.metrics.occupiedUnits} /{" "}
                        {payload[0].payload.metrics.activeUnits}
                      </p>
                    </div>
                  ) : null
                }
              />
              <Bar
                dataKey="percent"
                name={R.utilization}
                fill="#165f4d"
                maxBarSize={55}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {items
        .filter((item) => item.metrics.utilizationPercent === null)
        .map((item) => (
          <p key={item.facility.id} className="mt-2 text-xs text-amber-800">
            {item.facility.name}: {R.zeroInventory}
          </p>
        ))}
    </section>
  );
}
