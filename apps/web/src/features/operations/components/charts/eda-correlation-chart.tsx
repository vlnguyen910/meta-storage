"use client";

import type { OperationsOverview } from "@metastorage/contracts";
import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatPercentage } from "../../operations.utils";

interface EdaCorrelationChartProps {
  data: OperationsOverview;
}

export function EdaCorrelationChart({ data }: Readonly<EdaCorrelationChartProps>) {
  const chartData = useMemo(() => {
    return data.facilities.map((item) => {
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

  if (chartData.length === 0) return null;

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
      <CardHeader className="p-3.5 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">
              Phân tích tương quan: Doanh thu vs Tỷ lệ lấp đầy (Bivariate Correlation)
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs text-slate-500">
              Quan sát mối liên hệ giữa Dòng tiền ròng (cột xanh) và Công suất khai thác (đường cam)
              của từng cơ sở
            </CardDescription>
          </div>
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

        {/* Dynamic takeaway footer */}
        <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600 flex items-center justify-between">
          <span>
            💡 <strong>Quy luật EDA:</strong> Các trạm có tỷ lệ lấp đầy &gt; 85% nhưng doanh thu ở
            mức trung bình là cơ hội điều chỉnh tăng giá tối ưu (Yield Management).
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
