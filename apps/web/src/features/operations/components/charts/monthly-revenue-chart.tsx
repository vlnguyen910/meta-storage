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
import { formatMoney } from "../../operations.utils";
import { REPORTING_MESSAGES as R } from "../../operations-reporting.messages";
import type { MonthlyChartProps } from "./operations-chart.types";

export function MonthlyRevenueChart({ report }: MonthlyChartProps) {
  const [cash, setCash] = useState(false);
  const data = report.items.map((item) => ({
    ...item,
    label: `${item.month.slice(5)}/${item.month.slice(0, 4)}`,
    rental: item.rentalCollected === null ? null : Number(item.rentalCollected),
    received: Number(item.cashReceived),
    refunded: Number(item.cashRefunded),
  }));
  return (
    <section className="min-w-0 rounded-card border border-outline-variant bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{R.monthlyTitle}</h2>
        <div className="flex gap-1">
          <button
            className={`min-h-11 rounded border px-3 text-xs ${!cash ? "bg-primary text-white" : "bg-white text-ink"}`}
            type="button"
            aria-pressed={!cash}
            onClick={() => setCash(false)}
          >
            {R.rentalMode}
          </button>
          <button
            className={`min-h-11 rounded border px-3 text-xs ${cash ? "bg-primary text-white" : "bg-white text-ink"}`}
            type="button"
            aria-pressed={cash}
            onClick={() => setCash(true)}
          >
            {R.cashMode}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-600">{R.monthlyHelp}</p>
      <div className="mt-4 h-72 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} accessibilityLayer margin={{ left: 0, right: 8, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis
              width={70}
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => `${Number(value) / 1000000} tr`}
            />
            <Legend />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.[0] ? (
                  <div className="rounded border bg-white p-3 text-xs shadow">
                    <strong>{label}</strong>
                    <p>
                      {R.rental}:{" "}
                      {payload[0].payload.rentalCollected === null
                        ? R.unknown
                        : formatMoney(payload[0].payload.rentalCollected)}
                    </p>
                    <p>
                      {R.received}: {formatMoney(payload[0].payload.cashReceived)}
                    </p>
                    <p>
                      {R.refunded}: {formatMoney(payload[0].payload.cashRefunded)}
                    </p>
                    <p>
                      {R.net}: {formatMoney(payload[0].payload.netCash)}
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
      {report.items.some((item) => item.rentalCollected === null) && (
        <p role="status" className="mt-2 text-xs text-amber-800">
          {R.unknown}:{" "}
          {report.items
            .filter((item) => item.rentalCollected === null)
            .map((item) => item.month)
            .join(", ")}
        </p>
      )}
      {report.items.some((item) => item.unsupportedCurrencyPayments > 0) && (
        <p role="status" className="mt-2 text-xs text-amber-800">
          {R.excludedCurrency}
        </p>
      )}
      <details className="mt-3">
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
            <caption className="sr-only">{R.monthlyTitle}</caption>
            <thead>
              <tr>
                {R.monthlyHeadings.map((h) => (
                  <th key={h} className="whitespace-nowrap p-2" scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.items.map((item) => (
                <tr key={item.month}>
                  <th className="p-2" scope="row">
                    {item.month}
                  </th>
                  {[
                    item.rentalCollected,
                    item.depositCollected,
                    item.cashReceived,
                    item.cashRefunded,
                    item.netCash,
                  ].map((value, index) => (
                    <td key={R.monthlyHeadings[index + 1]} className="whitespace-nowrap p-2">
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
