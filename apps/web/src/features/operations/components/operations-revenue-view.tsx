"use client";

import axios from "axios";
import {
  Boxes,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { ListPagination } from "@/components/ui/list-pagination";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useOperationsCatalogOptions } from "../hooks/use-operations-catalog-options";
import { useOperationsMonthlyRevenue } from "../hooks/use-operations-monthly-revenue";
import { useOperationsRevenue } from "../hooks/use-operations-revenue";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { downloadCsv, formatMoney, getDefaultPeriod } from "../operations.utils";
import { DASHBOARD_MESSAGES as D } from "../operations-dashboard.messages";
import { REPORTING_MESSAGES as R } from "../operations-reporting.messages";
import { REPORTS_MESSAGES as RM } from "../operations-reports.messages";
import { ChartLoadingSkeleton } from "./charts/chart-loading-skeleton";

const FacilityRevenueChart = dynamic(
  () => import("./charts/facility-revenue-chart").then((module) => module.FacilityRevenueChart),
  { ssr: false, loading: () => <ChartLoadingSkeleton /> },
);
const MonthlyRevenueChart = dynamic(
  () => import("./charts/monthly-revenue-chart").then((module) => module.MonthlyRevenueChart),
  { ssr: false, loading: () => <ChartLoadingSkeleton /> },
);
const OperationsFinancialChart = dynamic(
  () =>
    import("./charts/operations-financial-chart").then((module) => module.OperationsFinancialChart),
  { ssr: false, loading: () => <ChartLoadingSkeleton /> },
);

const PAGE_SIZE = 20;
type ChartTab = "facility" | "monthly" | "cash";

export function OperationsRevenueView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const defaultPeriod = getDefaultPeriod();
  defaultPeriod.from = `${defaultPeriod.to.slice(0, 4)}-01-01`;
  const urlFacilityId = searchParams.get("facilityId");
  const urlUnitTypeId = searchParams.get("unitTypeId");
  const urlFrom = searchParams.get("from");
  const urlTo = searchParams.get("to");
  const urlPage = Number.parseInt(searchParams.get("page") ?? "1", 10);

  const [from, setFrom] = useState(urlFrom ?? defaultPeriod.from);
  const [to, setTo] = useState(urlTo ?? defaultPeriod.to);
  const [facilityId, setFacilityId] = useState(urlFacilityId ?? "all");
  const [unitTypeId, setUnitTypeId] = useState(urlUnitTypeId ?? "all");
  const [page, setPage] = useState(Number.isNaN(urlPage) || urlPage < 1 ? 1 : urlPage);

  const [chartTab, setChartTab] = useState<ChartTab>("facility");
  const [showCharts, setShowCharts] = useState(true);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { facilities: catalogFacilities, unitTypes: catalogUnitTypes } =
    useOperationsCatalogOptions();

  // Sync state if URL changes (back/forward navigation)
  useEffect(() => {
    setFacilityId(urlFacilityId ?? "all");
    setUnitTypeId(urlUnitTypeId ?? "all");
    setFrom(urlFrom ?? `${getDefaultPeriod().to.slice(0, 4)}-01-01`);
    setTo(urlTo ?? getDefaultPeriod().to);
    if (!Number.isNaN(urlPage) && urlPage >= 1) setPage(urlPage);
  }, [urlFacilityId, urlUnitTypeId, urlFrom, urlTo, urlPage]);

  // Update URL search params when filters or page change
  function updateUrl(newParams: {
    from?: string;
    to?: string;
    facilityId?: string;
    unitTypeId?: string;
    page?: number;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const targetFrom = newParams.from ?? from;
    const targetTo = newParams.to ?? to;
    const targetFacility = newParams.facilityId ?? facilityId;
    const targetUnitType = newParams.unitTypeId ?? unitTypeId;
    const targetPage = newParams.page ?? page;

    if (targetFrom) params.set("from", targetFrom);
    if (targetTo) params.set("to", targetTo);
    if (targetFacility && targetFacility !== "all") params.set("facilityId", targetFacility);
    else params.delete("facilityId");

    if (targetUnitType && targetUnitType !== "all") params.set("unitTypeId", targetUnitType);
    else params.delete("unitTypeId");

    if (targetPage > 1) params.set("page", String(targetPage));
    else params.delete("page");

    router.replace(`${routes.revenue}?${params.toString()}`);
  }

  const offset = (page - 1) * PAGE_SIZE;

  const query = useOperationsRevenue({
    from,
    to,
    facilityId,
    unitTypeId,
    limit: PAGE_SIZE,
    offset,
  });

  const { data, isPending, isError, refetch } = query;
  const monthly = useOperationsMonthlyRevenue({ from, to, facilityId, unitTypeId });

  function handleFilterChange(updates: {
    from?: string;
    to?: string;
    facilityId?: string;
    unitTypeId?: string;
  }) {
    if (updates.from !== undefined) setFrom(updates.from);
    if (updates.to !== undefined) setTo(updates.to);
    if (updates.facilityId !== undefined) setFacilityId(updates.facilityId);
    if (updates.unitTypeId !== undefined) setUnitTypeId(updates.unitTypeId);
    setPage(1);
    updateUrl({ ...updates, page: 1 });
  }

  function resetFilters() {
    const def = getDefaultPeriod();
    def.from = `${def.to.slice(0, 4)}-01-01`;
    setFrom(def.from);
    setTo(def.to);
    setFacilityId("all");
    setUnitTypeId("all");
    setPage(1);
    setExportError(null);
    updateUrl({
      from: def.from,
      to: def.to,
      facilityId: "all",
      unitTypeId: "all",
      page: 1,
    });
  }

  async function handleExport(type: "revenue" | "revenue-monthly" = "revenue") {
    try {
      setExporting(true);
      setExportError(null);
      const res = await api.reports.exportReport({
        type,
        from,
        to,
        facilityId: facilityId === "all" ? undefined : facilityId,
        unitTypeId: unitTypeId === "all" ? undefined : unitTypeId,
      });
      downloadCsv(res.data, res.filename);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        setExportError(M.exportErrorLimit);
      } else {
        setExportError(M.exportErrorGeneral);
      }
    } finally {
      setExporting(false);
    }
  }

  const selectedFacilityName =
    facilityId !== "all" ? catalogFacilities.find((f) => f.id === facilityId)?.name : undefined;

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
                onChange={(e) => handleFilterChange({ from: e.target.value })}
                className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-slate-800 focus:outline-none"
              />
              <span className="text-slate-300">→</span>
              <span className="font-medium text-slate-500">{D.filterDateTo}:</span>
              <input
                type="date"
                value={to}
                min={from}
                aria-label={D.filterDateTo}
                onChange={(e) => handleFilterChange({ to: e.target.value })}
                className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>

            {/* Facility Selector */}
            <DropdownSelect
              value={facilityId}
              onChange={(newFacilityId) => handleFilterChange({ facilityId: newFacilityId })}
              icon={<Building2 className="h-3.5 w-3.5" aria-hidden="true" />}
              ariaLabel={D.filterFacility}
              options={[
                { value: "all", label: M.allFacilities },
                ...catalogFacilities.map((fac) => ({ value: fac.id, label: fac.name })),
              ]}
              maxVisibleItems={6}
            />

            {/* Unit Type Selector */}
            <DropdownSelect
              value={unitTypeId}
              onChange={(newUnitTypeId) => handleFilterChange({ unitTypeId: newUnitTypeId })}
              icon={<Boxes className="h-3.5 w-3.5" aria-hidden="true" />}
              ariaLabel={D.filterUnitType}
              options={[
                { value: "all", label: M.allUnitTypes },
                ...catalogUnitTypes.map((ut) => ({ value: ut.unitTypeId, label: ut.name })),
              ]}
              maxVisibleItems={6}
            />

            {/* Reset Button */}
            <Button
              type="button"
              variant="outline"
              onClick={resetFilters}
              className="h-7 min-h-0 gap-1 rounded-lg border-dashed border-slate-300 px-2.5 text-xs text-slate-600 hover:text-slate-900"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>{D.filterReset}</span>
            </Button>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              loading={exporting}
              onClick={() => void handleExport("revenue")}
              className="h-7 min-h-0 gap-1 rounded-lg border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3 w-3 text-slate-500" aria-hidden="true" />
              <span>{R.facilityCsv}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              loading={exporting}
              onClick={() => void handleExport("revenue-monthly")}
              className="h-7 min-h-0 gap-1 rounded-lg border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3 w-3 text-slate-500" aria-hidden="true" />
              <span>{R.monthlyCsv}</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Selected Facility Context Banner */}
      {selectedFacilityName && (
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary shadow-xs">
          <span>{RM.filteringByFacility(selectedFacilityName)}</span>
          <button
            type="button"
            onClick={() => handleFilterChange({ facilityId: "all" })}
            className="cursor-pointer font-bold underline hover:text-primary-dark"
          >
            {RM.clearFacilityFilter}
          </button>
        </div>
      )}

      {exportError && (
        <p
          role="alert"
          className="m-0 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 shadow-xs"
        >
          {exportError}
        </p>
      )}

      {isPending ? (
        <LoadingState label={M.loading} variant="dashboard" />
      ) : isError || !data ? (
        <ErrorState message={M.error} onRetry={() => void refetch()} />
      ) : (
        <>
          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {/* Card 1: Tổng thực thu */}
            <Card className="flex flex-col justify-between border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between gap-1 text-slate-500">
                <span className="text-xs font-medium">{RM.totalCashReceived}</span>
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                  <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-1">
                <p className="text-lg font-bold tracking-tight text-slate-900">
                  {formatMoney(data.summary.cashReceived)}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {RM.cashBreakdown(
                    data.summary.rentalCollected === null
                      ? R.unknown
                      : formatMoney(data.summary.rentalCollected),
                    data.summary.depositCollected === null
                      ? R.unknown
                      : formatMoney(data.summary.depositCollected),
                  )}
                </p>
              </div>
            </Card>

            {/* Card 2: Dòng tiền ròng */}
            <Card className="flex flex-col justify-between border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between gap-1 text-slate-500">
                <span className="text-xs font-medium">{RM.netCashFlow}</span>
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-1">
                <p className="text-lg font-bold tracking-tight text-blue-700">
                  {formatMoney(data.summary.netCash)}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {RM.refundBreakdown(formatMoney(data.summary.cashRefunded))}
                </p>
              </div>
            </Card>

            {/* Card 3: Cọc đang giữ */}
            <Card className="flex flex-col justify-between border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between gap-1 text-slate-500">
                <span className="text-xs font-medium">{RM.depositHeld}</span>
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-700">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-1">
                <p className="text-lg font-bold tracking-tight text-slate-900">
                  {data.summary.depositHeld === null
                    ? R.unknown
                    : formatMoney(data.summary.depositHeld)}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {RM.depositForfeited}: {formatMoney(data.summary.depositForfeited)}
                </p>
              </div>
            </Card>

            {/* Card 4: Tổng cơ sở */}
            <Card className="flex flex-col justify-between border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between gap-1 text-slate-500">
                <span className="text-xs font-medium">{RM.totalFacilitiesCount}</span>
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                  <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-1">
                <p className="text-lg font-bold tracking-tight text-slate-900">
                  {data.total} cơ sở
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {D.periodLabel(from, to)}
                </p>
              </div>
            </Card>
          </div>

          {/* Interactive Visual Analytics Card with Tabs */}
          <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-3 pb-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{RM.chartSectionTitle}</span>
                  {/* Segmented control pills */}
                  <div className="flex items-center rounded-lg bg-slate-100 p-0.5 text-xs font-medium text-slate-600">
                    <button
                      type="button"
                      onClick={() => {
                        setChartTab("facility");
                        setShowCharts(true);
                      }}
                      className={cn(
                        "cursor-pointer rounded-md px-2.5 py-1 text-xs transition-colors",
                        chartTab === "facility"
                          ? "bg-white font-semibold text-slate-900 shadow-xs"
                          : "hover:text-slate-900",
                      )}
                    >
                      {RM.viewChartTabFacility}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChartTab("monthly");
                        setShowCharts(true);
                      }}
                      className={cn(
                        "cursor-pointer rounded-md px-2.5 py-1 text-xs transition-colors",
                        chartTab === "monthly"
                          ? "bg-white font-semibold text-slate-900 shadow-xs"
                          : "hover:text-slate-900",
                      )}
                    >
                      {RM.viewChartTabMonthly}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChartTab("cash");
                        setShowCharts(true);
                      }}
                      className={cn(
                        "cursor-pointer rounded-md px-2.5 py-1 text-xs transition-colors",
                        chartTab === "cash"
                          ? "bg-white font-semibold text-slate-900 shadow-xs"
                          : "hover:text-slate-900",
                      )}
                    >
                      {RM.viewChartTabCash}
                    </button>
                  </div>
                </div>

                {/* Collapse / Expand Toggle */}
                <button
                  type="button"
                  onClick={() => setShowCharts(!showCharts)}
                  className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  <span>{showCharts ? RM.chartToggleHide : RM.chartToggleShow}</span>
                  {showCharts ? (
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </CardHeader>

            {showCharts && (
              <CardContent className="border-t border-slate-100 p-3 pt-3">
                {chartTab === "facility" && (
                  <FacilityRevenueChart items={data.items} totalFacilities={data.total} />
                )}
                {chartTab === "monthly" &&
                  (monthly.isPending ? (
                    <LoadingState label={M.loading} variant="table" />
                  ) : monthly.isError || !monthly.data ? (
                    <ErrorState message={M.error} onRetry={() => void monthly.refetch()} />
                  ) : (
                    <MonthlyRevenueChart report={monthly.data} />
                  ))}
                {chartTab === "cash" && <OperationsFinancialChart metrics={data.summary} compact />}
              </CardContent>
            )}
          </Card>

          {/* Detailed Data Table */}
          <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-slate-200 bg-slate-50/90">
                  <TableRow className="hover:bg-transparent">
                    {R.facilityRevenueHeadings.map((heading) => (
                      <TableHead
                        key={heading}
                        className="whitespace-nowrap px-3.5 py-2.5 text-xs font-semibold text-slate-700"
                      >
                        {heading}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map(({ facility, metrics }) => (
                    <TableRow key={facility.id} className="transition-colors hover:bg-slate-50/60">
                      <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs font-semibold text-slate-900">
                        {facility.name}
                        <span className="ml-1.5 font-mono text-xs font-normal text-slate-500">
                          ({facility.code})
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs font-bold tabular-nums text-slate-900">
                        {formatMoney(metrics.cashReceived)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs tabular-nums text-slate-700">
                        {metrics.rentalCollected !== null ? (
                          formatMoney(metrics.rentalCollected)
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-800"
                          >
                            {M.dataNeedsReconciliation}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs tabular-nums text-slate-700">
                        {formatMoney(metrics.depositCollected)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs font-medium tabular-nums text-rose-600">
                        {formatMoney(metrics.cashRefunded)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap px-3.5 py-2.5 text-xs font-bold tabular-nums",
                          Number.parseFloat(metrics.netCash) < 0
                            ? "text-rose-600"
                            : "text-emerald-700",
                        )}
                      >
                        {formatMoney(metrics.netCash)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs tabular-nums text-slate-700">
                        {metrics.depositHeld !== null ? (
                          formatMoney(metrics.depositHeld)
                        ) : (
                          <span className="text-xs text-amber-700">
                            {M.dataNeedsReconciliation}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs tabular-nums text-slate-600">
                        {formatMoney(metrics.depositForfeited)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Unattributed row if present */}
                  {data.unattributed && (
                    <TableRow className="border-t-2 border-amber-200 bg-amber-50/40">
                      <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs font-bold text-amber-900">
                        {M.unattributedLabel}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs font-bold tabular-nums text-amber-950">
                        {formatMoney(data.unattributed.cashReceived)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs tabular-nums text-amber-900">
                        {data.unattributed.rentalCollected !== null ? (
                          formatMoney(data.unattributed.rentalCollected)
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-100 px-1.5 py-0 text-[10px] text-amber-800"
                          >
                            {M.dataNeedsReconciliation}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs tabular-nums text-amber-900">
                        {formatMoney(data.unattributed.depositCollected)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs font-medium tabular-nums text-rose-700">
                        {formatMoney(data.unattributed.cashRefunded)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs font-bold tabular-nums text-amber-950">
                        {formatMoney(data.unattributed.netCash)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs tabular-nums text-amber-900">
                        {data.unattributed.depositHeld !== null ? (
                          formatMoney(data.unattributed.depositHeld)
                        ) : (
                          <span className="text-xs text-amber-700">
                            {M.dataNeedsReconciliation}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs tabular-nums text-amber-900">
                        {formatMoney(data.unattributed.depositForfeited)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls with Direct Jump & Ellipsis Jump */}
            <div className="border-t border-slate-100 p-2.5">
              <ListPagination
                label={M.titles.revenue}
                page={page}
                pageSize={PAGE_SIZE}
                total={data.total}
                unitLabel="cơ sở"
                onPageChange={(newPage) => {
                  setPage(newPage);
                  updateUrl({ page: newPage });
                }}
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
