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

export function OperationsFinancialChart({ metrics, compact = false }: FinancialChartProps) {
  const received = Number(metrics.cashReceived);
  const net = Number(metrics.netCash);
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

  const chartContent = (
    <>
      {metrics.unsupportedCurrencyPayments > 0 && (
        <p role="status" className="mb-2 text-xs font-medium text-amber-800">
          {R.excludedCurrency}
        </p>
      )}
      <div className={compact ? "h-36 sm:h-40 min-w-0" : "mt-4 h-60 min-w-0"}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ left: 0, right: 8, top: 8, bottom: 4 }}
            accessibilityLayer
          >
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
            <YAxis
              tickFormatter={(value) => `${Number(value) / 1000000} tr`}
              width={56}
              tick={{ fontSize: 11 }}
            />
            <ReferenceLine y={0} stroke="#cbd5e1" />
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
                    <p className="font-semibold">{payload[0].payload.name}</p>
                    <p className="text-emerald-400 font-bold">
                      {formatMoney(payload[0].payload.exact)}
                    </p>
                    {payload[0].payload.name === R.received && (
                      <div className="mt-1 border-t border-slate-700 pt-1 text-[11px] text-slate-300">
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
                      </div>
                    )}
                  </div>
                ) : null
              }
            />
            <Bar
              dataKey="range"
              isAnimationActive={false}
              maxBarSize={compact ? 50 : 85}
              radius={[4, 4, 0, 0]}
            >
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5 text-xs">
        {data.map((item) => (
          <div key={item.name} className="rounded-md bg-slate-50/80 p-2 text-center">
            <span className="block text-[11px] text-slate-500">{item.name}</span>
            <strong className="block text-xs font-bold text-slate-800 break-words">
              {formatMoney(item.exact)}
            </strong>
          </div>
        ))}
      </div>
      {!compact && (
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
              {metrics.depositCollected === null
                ? R.unknown
                : formatMoney(metrics.depositCollected)}
            </dd>
          </dl>
        </details>
      )}
    </>
  );

  if (compact) {
    return <div className="min-w-0">{chartContent}</div>;
  }

  return (
    <section className="min-w-0 rounded-card border border-outline-variant bg-white p-5">
      <h2 className="text-lg font-bold">{R.financialTitle}</h2>
      <p className="mt-1 text-xs text-slate-600">{R.financialHelp}</p>
      {chartContent}
    </section>
  );
}
