"use client";

import type { OperationsOverview } from "@metastorage/contracts";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { formatMoney, formatPercentage } from "../../operations.utils";
import { DASHBOARD_MESSAGES as D } from "../../operations-dashboard.messages";

interface EdaCorrelationChartProps {
  data: OperationsOverview;
}

export function EdaCorrelationChart({ data }: Readonly<EdaCorrelationChartProps>) {
  const chartData = useMemo(() => {
    const sorted = [...data.facilities].sort(
      (a, b) => Number(b.financial.netCash || 0) - Number(a.financial.netCash || 0),
    );
    return sorted.map((item) => {
      const netCash = Number(item.financial.netCash || 0);
      const occupancy = Number(item.inventory.utilizationPercent || 0);
      const shortName =
        item.facility.name.length > 16 ? `${item.facility.name.slice(0, 14)}…` : item.facility.name;

      return {
        name: shortName,
        fullName: item.facility.name,
        code: item.facility.code,
        netCash,
        occupancy,
        occupiedUnits: item.inventory.occupiedUnits,
        totalUnits: item.inventory.totalUnits,
      };
    });
  }, [data.facilities]);

  const stats = useMemo(() => {
    const n = chartData.length;
    if (n === 0) return { n: 0, meanNetCash: 0, meanOccupancy: 0 };
    const meanNetCash = chartData.reduce((acc, d) => acc + d.netCash, 0) / n;
    const meanOccupancy = chartData.reduce((acc, d) => acc + d.occupancy, 0) / n;
    return { n, meanNetCash, meanOccupancy };
  }, [chartData]);

  if (chartData.length === 0) return null;

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
      <CardHeader className="p-3.5 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-sm font-bold text-slate-900">
                {D.facilityPerformanceTitle}
              </CardTitle>
              <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-600">
                {stats.n} cơ sở
              </Badge>
              {stats.meanNetCash > 0 && (
                <Badge
                  variant="outline"
                  className="border-blue-200 bg-blue-50 text-[10px] font-medium text-blue-700"
                >
                  {D.meanRevenueBadge(formatMoney(Math.round(stats.meanNetCash)))}
                </Badge>
              )}
              {stats.meanOccupancy > 0 && (
                <Badge
                  variant="outline"
                  className="border-orange-200 bg-orange-50 text-[10px] font-medium text-orange-700"
                >
                  {D.meanOccupancyBadge(formatPercentage(stats.meanOccupancy))}
                </Badge>
              )}
            </div>
            <CardDescription className="mt-0.5 text-xs text-slate-500">
              {D.facilityPerformanceSubtitle}
            </CardDescription>
          </div>
          <Link
            href={`${routes.revenue}?from=${data.period.from}&to=${data.period.to}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <span>{D.viewAllRevenue}</span>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-3.5 pt-0">
        <div className="h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 12, right: 16, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="code"
                tick={{ fontSize: 11, fill: "#475569" }}
                interval={0}
                tickLine={false}
              />
              {/* Left Y Axis: Net Cash */}
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 10, fill: "#475569" }}
                tickFormatter={(val: number) => {
                  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}M`;
                  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
                  return `${val}`;
                }}
                tickLine={false}
                axisLine={false}
              />
              {/* Right Y Axis: Occupancy % */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#f97316" }}
                tickFormatter={(val: number) => `${val}%`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0]?.payload as (typeof chartData)[0] | undefined;
                  if (!item) return null;
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-md">
                      <p className="font-bold text-slate-900">
                        {item.fullName} ({item.code})
                      </p>
                      <div className="mt-1.5 flex flex-col gap-1 border-t border-slate-100 pt-1.5 text-slate-600">
                        <div className="flex justify-between gap-4">
                          <span>Dòng tiền ròng:</span>
                          <span className="font-semibold text-blue-700">
                            {formatMoney(item.netCash)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Tỷ lệ lấp đầy:</span>
                          <span className="font-semibold text-orange-600">
                            {formatPercentage(item.occupancy)} ({item.occupiedUnits}/
                            {item.totalUnits} ô)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 8, fontSize: 11 }}
              />
              {stats.meanNetCash > 0 && (
                <ReferenceLine
                  yAxisId="left"
                  y={stats.meanNetCash}
                  stroke="#3b82f6"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
              )}
              {stats.meanOccupancy > 0 && (
                <ReferenceLine
                  yAxisId="right"
                  y={stats.meanOccupancy}
                  stroke="#f97316"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
              )}
              <Bar
                yAxisId="left"
                dataKey="netCash"
                name="Doanh thu ròng (VND)"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="occupancy"
                name="Tỷ lệ lấp đầy (%)"
                stroke="#f97316"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#ea580c" }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
