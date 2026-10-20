"use client";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "../../operations.utils";
import { REPORTING_MESSAGES as R } from "../../operations-reporting.messages";
import type { FinancialChartProps } from "./operations-chart.types";

export function OperationsFinancialChart({ metrics }: FinancialChartProps) {
  const received = Number(metrics.cashReceived),
    net = Number(metrics.netCash);
  const data = [
    { name: R.received, range: [0, received], exact: metrics.cashReceived, color: "#165f4d" },
    { name: R.refunded, range: [net, received], exact: metrics.cashRefunded, color: "#be123c" },
    {
      name: R.net,
      range: [Math.min(0, net), Math.max(0, net)],
      exact: metrics.netCash,
      color: net < 0 ? "#be123c" : "#2563eb",
    },
  ];
  return (
    <section className="min-w-0 rounded-card border border-outline-variant bg-white p-5">
      <h2 className="text-lg font-bold">{R.financialTitle}</h2>
      <p className="mt-1 text-xs text-slate-600">{R.financialHelp}</p>
      {metrics.unsupportedCurrencyPayments > 0 && (
        <p role="status" className="mt-2 text-xs text-amber-800">
          {R.excludedCurrency}
        </p>
      )}
      <div className="mt-4 h-60 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ left: 8, right: 8, top: 12, bottom: 8 }}
            accessibilityLayer
          >
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
            <YAxis
              tickFormatter={(value) => `${Number(value) / 1000000} tr`}
              width={68}
              tick={{ fontSize: 11 }}
            />
            <ReferenceLine y={0} stroke="#64748b" />
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <div className="rounded border bg-white p-3 text-sm shadow">
                    <strong>{payload[0].payload.name}</strong>
                    <p>{formatMoney(payload[0].payload.exact)}</p>
                    {payload[0].payload.name === R.received && (
                      <>
                        <p>
                          {R.rental}:{" "}
                          {metrics.rentalCollected === null
                            ? R.unknown
                            : formatMoney(metrics.rentalCollected)}
                        </p>
                        <p>
                          {R.deposit}:{" "}
                          {metrics.depositCollected === null
                            ? R.unknown
                            : formatMoney(metrics.depositCollected)}
                        </p>
                      </>
                    )}
                  </div>
                ) : null
              }
            />
            <Bar dataKey="range" isAnimationActive={false} maxBarSize={85}>
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t pt-3 text-xs">
        {data.map((item) => (
          <div key={item.name}>
            <span className="block text-slate-600">{item.name}</span>
            <strong className="break-words">{formatMoney(item.exact)}</strong>
          </div>
        ))}
      </div>
      <details className="mt-3 text-xs">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold text-primary">
          {R.exactData}
        </summary>
        <dl className="grid grid-cols-2 gap-2">
          <dt>{R.rental}</dt>
          <dd>
            {metrics.rentalCollected === null ? R.unknown : formatMoney(metrics.rentalCollected)}
          </dd>
          <dt>{R.deposit}</dt>
          <dd>
            {metrics.depositCollected === null ? R.unknown : formatMoney(metrics.depositCollected)}
          </dd>
        </dl>
      </details>
    </section>
  );
}
