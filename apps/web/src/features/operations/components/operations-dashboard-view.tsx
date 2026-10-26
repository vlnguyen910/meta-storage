"use client";

import {
  AlertCircle,
  ArrowRight,
  Boxes,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { useOperationsCatalogOptions } from "../hooks/use-operations-catalog-options";
import { useOperationsOverview } from "../hooks/use-operations-overview";
import { useOperationsRevenue } from "../hooks/use-operations-revenue";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import {
  formatDateTimeVn,
  formatMoney,
  formatPercentage,
  getDefaultPeriod,
} from "../operations.utils";
import { DASHBOARD_MESSAGES as D } from "../operations-dashboard.messages";
import { REPORTING_MESSAGES as R } from "../operations-reporting.messages";
import { ChartLoadingSkeleton } from "./charts/chart-loading-skeleton";

const FacilityRevenueChart = dynamic(
  () => import("./charts/facility-revenue-chart").then((module) => module.FacilityRevenueChart),
  { ssr: false, loading: () => <ChartLoadingSkeleton /> },
);
const FacilityUtilizationDonutChart = dynamic(
  () =>
    import("./charts/facility-utilization-donut-chart").then(
      (module) => module.FacilityUtilizationDonutChart,
    ),
  { ssr: false, loading: () => <ChartLoadingSkeleton /> },
);
const OperationsFinancialChart = dynamic(
  () =>
    import("./charts/operations-financial-chart").then((module) => module.OperationsFinancialChart),
  { ssr: false, loading: () => <ChartLoadingSkeleton /> },
);

export function OperationsDashboardView() {
  const [showPreview, setShowPreview] = useState(false);
  const period = getDefaultPeriod();
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const [facilityId, setFacilityId] = useState("all");
  const [unitTypeId, setUnitTypeId] = useState("all");

  const { facilities, unitTypes } = useOperationsCatalogOptions();
  const filter = { from, to, facilityId, unitTypeId };
  const query = useOperationsOverview(filter);
  const preview = useOperationsRevenue({ ...filter, limit: 5, offset: 0 });
  const data = query.data;

  const reportParams = new URLSearchParams({ from, to });
  if (facilityId !== "all") reportParams.set("facilityId", facilityId);
  if (unitTypeId !== "all") reportParams.set("unitTypeId", unitTypeId);

  const handleResetFilters = () => {
    const p = getDefaultPeriod();
    setFrom(p.from);
    setTo(p.to);
    setFacilityId("all");
    setUnitTypeId("all");
  };

  return (
    <div className="flex min-w-0 flex-col gap-3 pb-3">
      {/* Compact Filter Toolbar */}
      <Card className="border-slate-200 bg-white p-2.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Date Range Picker */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              <span className="font-medium text-slate-500">{D.filterDateFrom}:</span>
              <input
                type="date"
                value={from}
                max={to}
                aria-label={D.filterDateFrom}
                onChange={(e) => setFrom(e.target.value)}
                className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-slate-800 focus:outline-none"
              />
              <span className="text-slate-300">→</span>
              <span className="font-medium text-slate-500">{D.filterDateTo}:</span>
              <input
                type="date"
                value={to}
                min={from}
                aria-label={D.filterDateTo}
                onChange={(e) => setTo(e.target.value)}
                className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>

            {/* Facility Selector */}
            <DropdownSelect
              value={facilityId}
              onChange={setFacilityId}
              icon={<Building2 className="h-3.5 w-3.5" aria-hidden="true" />}
              ariaLabel={D.filterFacility}
              options={[
                { value: "all", label: M.allFacilities },
                ...facilities.map((f) => ({ value: f.id, label: f.name })),
              ]}
              maxVisibleItems={6}
            />

            {/* Unit Type Selector */}
            <DropdownSelect
              value={unitTypeId}
              onChange={setUnitTypeId}
              icon={<Boxes className="h-3.5 w-3.5" aria-hidden="true" />}
              ariaLabel={D.filterUnitType}
              options={[
                { value: "all", label: M.allUnitTypes },
                ...unitTypes.map((t) => ({ value: t.unitTypeId, label: t.name })),
              ]}
              maxVisibleItems={6}
            />

            {/* Reset Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleResetFilters}
              className="h-7 min-h-0 gap-1 rounded-lg border-dashed border-slate-300 px-2.5 text-xs text-slate-600 hover:text-slate-900"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>{D.filterReset}</span>
            </Button>
          </div>

          {/* Realtime As Of Badge */}
          {data && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>{D.asOfLabel(formatDateTimeVn(data.asOf))}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Main Content Area */}
      {query.isPending ? (
        <LoadingState label={M.loading} variant="dashboard" />
      ) : query.isError || !data ? (
        <ErrorState message={M.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          {/* Executive Summary: 4 KPI Cards */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {/* Card 1: Cash Received */}
            <Card className="flex flex-col justify-between border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between gap-1 text-slate-500">
                <span className="text-xs font-medium">{D.cashReceived}</span>
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                  <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-1">
                <p className="text-lg font-bold tracking-tight text-slate-900">
                  {formatMoney(data.summary.financial.cashReceived)}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {D.rentalCollectedShort}:{" "}
                  {data.summary.financial.rentalCollected === null
                    ? R.unknown
                    : formatMoney(data.summary.financial.rentalCollected)}
                </p>
              </div>
            </Card>

            {/* Card 2: Net Cash */}
            <Card className="flex flex-col justify-between border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between gap-1 text-slate-500">
                <span className="text-xs font-medium">{D.netCash}</span>
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-1">
                <p className="text-lg font-bold tracking-tight text-blue-700">
                  {formatMoney(data.summary.financial.netCash)}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {D.cashRefundedShort}: {formatMoney(data.summary.financial.cashRefunded)}
                </p>
              </div>
            </Card>

            {/* Card 3: Utilization Rate */}
            <Card className="flex flex-col justify-between border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between gap-1 text-slate-500">
                <span className="text-xs font-medium">{D.utilization}</span>
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-[#165f4d]">
                  <Boxes className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-1">
                <p className="text-lg font-bold tracking-tight text-slate-900">
                  {formatPercentage(data.summary.inventory.utilizationPercent ?? 0)}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {D.activeUnitsSummary(
                    data.summary.inventory.occupiedUnits,
                    data.summary.inventory.activeUnits,
                    data.summary.inventory.availableUnits,
                  )}
                </p>
              </div>
            </Card>

            {/* Card 4: Held Deposit & Pending Refunds */}
            <Card className="flex flex-col justify-between border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between gap-1 text-slate-500">
                <span className="text-xs font-medium">{D.depositHeld}</span>
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-700">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-1">
                <p className="text-lg font-bold tracking-tight text-slate-900">
                  {data.summary.financial.depositHeld === null
                    ? R.unknown
                    : formatMoney(data.summary.financial.depositHeld)}
                </p>
                <Link
                  href={`${routes.reports}?tab=refunds`}
                  className="mt-0.5 block truncate text-[11px] font-medium text-amber-700 hover:text-amber-800 hover:underline"
                >
                  {data.attention.refunds.count > 0
                    ? D.refundsPendingDetail(
                        data.attention.refunds.count,
                        formatMoney(data.attention.refunds.amount),
                      )
                    : D.noRefundsPending}
                </Link>
              </div>
            </Card>
          </div>

          {/* Attention Banner if Data Quality Issues */}
          {data.attention.dataQuality.hasIssues && (
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-900 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span className="font-medium">{D.dataQualityWarning}</span>
              </div>
              <Link
                href={`${routes.reports}?tab=reconciliation`}
                className="ml-2 shrink-0 font-semibold text-amber-800 underline hover:text-amber-950"
              >
                {M.actionViewReconciliation} →
              </Link>
            </div>
          )}

          {/* Analytics Charts Grid */}
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            {/* Financial Flow Chart */}
            <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
              <CardHeader className="p-3.5 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-slate-900">
                    {R.financialTitle}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="border-slate-200 py-0 text-[10px] font-normal text-slate-500"
                  >
                    {D.periodLabel(data.period.from, data.period.to)}
                  </Badge>
                </div>
                <CardDescription className="mt-0.5 text-xs text-slate-500">
                  {R.financialHelp}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3.5 pt-0">
                <OperationsFinancialChart metrics={data.summary.financial} compact />
              </CardContent>
            </Card>

            {/* Utilization Rate Donut Chart */}
            <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
              <CardHeader className="p-3.5 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Tỷ lệ khai thác hiện tại
                  </CardTitle>
                  <Link
                    href={routes.utilization}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <span>{D.viewAllUtilization}</span>
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
                <CardDescription className="mt-0.5 text-xs text-slate-500">
                  Ô đang thuê / ô khai thác (loại trừ ngừng hoạt động)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3.5 pt-0">
                <FacilityUtilizationDonutChart metrics={data.summary.inventory} compact />
              </CardContent>
            </Card>
          </div>

          {/* Collapsible Top 5 Facilities Section */}
          <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex w-full cursor-pointer items-center justify-between p-3 text-left transition-colors hover:bg-slate-50/70"
            >
              <div className="flex items-center gap-2">
                {showPreview ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
                )}
                <span className="text-xs font-bold text-slate-900">{D.topFacilities}</span>
                <Badge variant="outline" className="py-0 text-[10px] font-normal text-slate-500">
                  {R.facilityPreview}
                </Badge>
              </div>
              <Link
                href={`${routes.revenue}?${reportParams}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <span>{D.viewAllRevenue}</span>
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </button>

            {showPreview && (
              <div className="border-t border-slate-100 p-3.5 pt-0">
                <p className="mb-3 text-xs text-slate-500">{D.topFacilitiesHelp}</p>
                {preview.isPending ? (
                  <LoadingState label={M.loading} variant="table" />
                ) : preview.isError || !preview.data ? (
                  <ErrorState message={M.error} onRetry={() => void preview.refetch()} />
                ) : (
                  <FacilityRevenueChart
                    items={preview.data.items}
                    totalFacilities={preview.data.total}
                    limit={5}
                  />
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
