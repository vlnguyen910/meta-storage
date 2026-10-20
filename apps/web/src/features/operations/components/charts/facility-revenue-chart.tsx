"use client";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { OPERATIONS_MESSAGES as M } from "../../operations.messages";
import { formatMoney } from "../../operations.utils";
import { REPORTING_MESSAGES as R } from "../../operations-reporting.messages";
import type { FacilityRevenueChartProps } from "./operations-chart.types";

export function FacilityRevenueChart({
  items,
  totalFacilities,
  limit,
}: Readonly<FacilityRevenueChartProps>) {
  const [cash, setCash] = useState(false);
  const visible = limit ? items.slice(0, limit) : items;
  const data = visible.map((item) => ({
    ...item,
    code:
      item.facility.code.length > 12 ? `${item.facility.code.slice(0, 10)}…` : item.facility.code,
    rental: item.metrics.rentalCollected === null ? null : Number(item.metrics.rentalCollected),
    received: Number(item.metrics.cashReceived),
    refunded: Number(item.metrics.cashRefunded),
  }));
  return (
    <section className="min-w-0 rounded-card border border-outline-variant bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">{R.facilityChart}</h2>
          <p className="text-xs text-slate-600">
            {M.showingFacilitiesCount(visible.length, totalFacilities)}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className={`min-h-11 rounded border px-3 text-xs ${!cash ? "bg-primary text-white" : "bg-white text-ink"}`}
            aria-pressed={!cash}
            onClick={() => setCash(false)}
          >
            {R.rentalMode}
          </button>
          <button
            type="button"
            className={`min-h-11 rounded border px-3 text-xs ${cash ? "bg-primary text-white" : "bg-white text-ink"}`}
            aria-pressed={cash}
            onClick={() => setCash(true)}
          >
            {R.cashMode}
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-sm">{R.empty}</p>
      ) : (
        <div className="mt-4 h-72 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} accessibilityLayer margin={{ left: 0, right: 8, bottom: 15 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="code"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-25}
                textAnchor="end"
              />
              <YAxis
                width={70}
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => `${Number(value) / 1000000} tr`}
              />
              <Legend />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <div className="rounded border bg-white p-3 text-xs shadow">
                      <strong>{payload[0].payload.facility.name}</strong>
                      <p>
                        {R.rental}:{" "}
                        {payload[0].payload.metrics.rentalCollected === null
                          ? R.unknown
                          : formatMoney(payload[0].payload.metrics.rentalCollected)}
                      </p>
                      <p>
                        {R.received}: {formatMoney(payload[0].payload.metrics.cashReceived)}
                      </p>
                      <p>
                        {R.refunded}: {formatMoney(payload[0].payload.metrics.cashRefunded)}
                      </p>
                    </div>
                  ) : null
                }
              />
              {cash ? (
                <>
                  <Bar
                    dataKey="received"
                    name={R.received}
                    fill="#165f4d"
                    maxBarSize={40}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="refunded"
                    name={R.refunded}
                    fill="#be123c"
                    maxBarSize={40}
                    isAnimationActive={false}
                  />
                </>
              ) : (
                <Bar
                  dataKey="rental"
                  name={R.rental}
                  fill="#165f4d"
                  maxBarSize={55}
                  isAnimationActive={false}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {visible
        .filter((item) => item.metrics.rentalCollected === null)
        .map((item) => (
          <p key={item.facility.id} className="mt-2 text-xs text-amber-800">
            {item.facility.name}: {R.unknown}
          </p>
        ))}
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold text-primary">
          {R.exactData}
        </summary>
        <section
          className="overflow-x-auto"
          aria-label={R.exactData}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard access to horizontal table scrolling.
          tabIndex={0}
        >
          <table className="w-full text-left text-xs">
            <caption className="sr-only">{R.facilityChart}</caption>
            <thead>
              <tr>
                {[M.facilityFilter, R.rental, R.received, R.refunded].map((h) => (
                  <th key={h} className="p-2" scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.facility.id}>
                  <th className="p-2" scope="row">
                    {item.facility.name} ({item.facility.code})
                  </th>
                  {[
                    item.metrics.rentalCollected,
                    item.metrics.cashReceived,
                    item.metrics.cashRefunded,
                  ].map((value, index) => (
                    <td
                      key={[R.rental, R.received, R.refunded][index]}
                      className="whitespace-nowrap p-2"
                    >
                      {value === null ? R.unknown : formatMoney(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </details>
    </section>
  );
}
