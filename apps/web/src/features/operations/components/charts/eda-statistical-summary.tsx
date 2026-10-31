"use client";

import type { OperationsOverview } from "@metastorage/contracts";
import {
  Activity,
  BarChart2,
  CheckCircle2,
  Database,
  Layers,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatPercentage } from "../../operations.utils";

interface EdaStatisticalSummaryProps {
  data: OperationsOverview;
}

export function EdaStatisticalSummary({ data }: Readonly<EdaStatisticalSummaryProps>) {
  const stats = useMemo(() => {
    const facilities = data.facilities;
    const n = facilities.length;

    if (n === 0) return null;

    // Doanh thu ròng của từng cơ sở
    const netCashList = facilities.map((f) => Number(f.financial.netCash || 0));
    // Tỷ lệ lấp đầy của từng cơ sở
    const occupancyList = facilities.map((f) => Number(f.inventory.utilizationPercent || 0));

    // Mean
    const meanNetCash = netCashList.reduce((acc, val) => acc + val, 0) / n;
    const meanOccupancy = occupancyList.reduce((acc, val) => acc + val, 0) / n;

    // Median
    const sortedCash = [...netCashList].sort((a, b) => a - b);
    const sortedOccupancy = [...occupancyList].sort((a, b) => a - b);
    const mid = Math.floor(n / 2);
    const medianNetCash =
      n % 2 !== 0
        ? (sortedCash[mid] ?? 0)
        : ((sortedCash[mid - 1] ?? 0) + (sortedCash[mid] ?? 0)) / 2;
    const medianOccupancy =
      n % 2 !== 0
        ? (sortedOccupancy[mid] ?? 0)
        : ((sortedOccupancy[mid - 1] ?? 0) + (sortedOccupancy[mid] ?? 0)) / 2;

    // Min / Max / Range
    const minCash = Math.min(...netCashList);
    const maxCash = Math.max(...netCashList);
    const rangeCash = maxCash - minCash;

    const minOccupancy = Math.min(...occupancyList);
    const maxOccupancy = Math.max(...occupancyList);
    const rangeOccupancy = maxOccupancy - minOccupancy;

    // Standard Deviation (Độ lệch chuẩn)
    const stdDevCash =
      n > 1
        ? Math.sqrt(netCashList.reduce((acc, val) => acc + (val - meanNetCash) ** 2, 0) / (n - 1))
        : 0;

    const stdDevOccupancy =
      n > 1
        ? Math.sqrt(
            occupancyList.reduce((acc, val) => acc + (val - meanOccupancy) ** 2, 0) / (n - 1),
          )
        : 0;

    return {
      n,
      meanNetCash,
      meanOccupancy,
      medianNetCash,
      medianOccupancy,
      minCash,
      maxCash,
      rangeCash,
      minOccupancy,
      maxOccupancy,
      rangeOccupancy,
      stdDevCash,
      stdDevOccupancy,
    };
  }, [data.facilities]);

  const totalOccupiedUnits = useMemo(() => {
    return data.facilities.reduce((acc, f) => acc + f.inventory.occupiedUnits, 0);
  }, [data.facilities]);

  const hasDataIssues = data.attention.dataQuality.hasIssues;

  return (
    <div className="flex flex-col gap-3">
      {/* EDA Header & Data Understanding */}
      <div className="rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-slate-50 p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Khám phá dữ liệu vận hành (Exploratory Data Analysis - EDA)
                </h3>
                <Badge
                  variant="outline"
                  className="border-emerald-300 bg-emerald-100/50 text-[10px] font-semibold text-emerald-800"
                >
                  Role BOM
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Mô tả cấu trúc dữ liệu, phân tích thống kê mô tả, kiểm tra độ phân tán và độ sạch
                của dữ liệu
              </p>
            </div>
          </div>

          {/* Data Health Indicator */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500">Chất lượng dữ liệu:</span>
            {!hasDataIssues ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Chuẩn xác (Clean)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                <Activity className="h-3.5 w-3.5 text-amber-600" />
                Cần đối soát ({data.attention.dataQuality.unclassifiedCollectedPayments} món)
              </span>
            )}
          </div>
        </div>

        {/* 4 Micro scale indicators */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 pt-2 border-t border-emerald-200/40 text-xs">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-600">Quy mô:</span>
            <span className="font-bold text-slate-900">{data.facilities.length} chi nhánh</span>
          </div>
          <div className="flex items-center gap-2">
            <BarChart2 className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-600">Tổng ô kho:</span>
            <span className="font-bold text-slate-900">{data.summary.inventory.totalUnits} ô</span>
          </div>
          <div className="flex items-center gap-2">
            <Scale className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-600">Ô đang thuê:</span>
            <span className="font-bold text-slate-900">{totalOccupiedUnits} ô</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-slate-600">Tỷ lệ lấp đầy:</span>
            <span className="font-bold text-emerald-700">
              {formatPercentage(data.summary.inventory.utilizationPercent ?? 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Statistical Measures Table (Descriptive Statistics) */}
      {stats && (
        <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-3.5 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-slate-900">
                  Thống kê mô tả các biến chính (Descriptive Statistics Table)
                </CardTitle>
                <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-500">
                  Mẫu: N = {stats.n} cơ sở
                </Badge>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Đo lường xu hướng tập trung (Mean, Median), độ biến thiên (Range) và độ phân tán chuẩn
              (Std Dev)
            </p>
          </CardHeader>

          <CardContent className="p-3.5 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="py-2 px-3">Biến quan sát</th>
                    <th className="py-2 px-3">Trung bình (Mean - x̄)</th>
                    <th className="py-2 px-3">Trung vị (Median)</th>
                    <th className="py-2 px-3">Cực trị [Min – Max]</th>
                    <th className="py-2 px-3">Biến thiên (Range)</th>
                    <th className="py-2 px-3">Độ lệch chuẩn (Std Dev - s)</th>
                    <th className="py-2 px-3">Đánh giá phân phối</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Row 1: Doanh thu ròng */}
                  <tr className="hover:bg-slate-50/60">
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      Dòng tiền ròng (Net Cash)
                    </td>
                    <td className="py-2 px-3 font-bold text-blue-700">
                      {formatMoney(Math.round(stats.meanNetCash))}
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      {formatMoney(Math.round(stats.medianNetCash))}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      [{formatMoney(stats.minCash)} – {formatMoney(stats.maxCash)}]
                    </td>
                    <td className="py-2 px-3 text-slate-600 font-medium">
                      {formatMoney(stats.rangeCash)}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      ±{formatMoney(Math.round(stats.stdDevCash))}
                    </td>
                    <td className="py-2 px-3">
                      {Math.abs(stats.meanNetCash - stats.medianNetCash) <
                      stats.meanNetCash * 0.15 ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Đối xứng (Symmetric)
                        </span>
                      ) : stats.meanNetCash > stats.medianNetCash ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          <TrendingUp className="h-3 w-3" /> Lệch phải (Right-skew)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                          <TrendingDown className="h-3 w-3" /> Lệch trái (Left-skew)
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Row 2: Tỷ lệ lấp đầy */}
                  <tr className="hover:bg-slate-50/60">
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      Tỷ lệ lấp đầy (Occupancy %)
                    </td>
                    <td className="py-2 px-3 font-bold text-emerald-700">
                      {formatPercentage(stats.meanOccupancy)}
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      {formatPercentage(stats.medianOccupancy)}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      [{formatPercentage(stats.minOccupancy)} –{" "}
                      {formatPercentage(stats.maxOccupancy)}]
                    </td>
                    <td className="py-2 px-3 text-slate-600 font-medium">
                      {formatPercentage(stats.rangeOccupancy)}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      ±{formatPercentage(stats.stdDevOccupancy)}
                    </td>
                    <td className="py-2 px-3">
                      {stats.stdDevOccupancy <= 15 ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Đồng đều cao (Low Var)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          Độ lệch lớn giữa trạm
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
