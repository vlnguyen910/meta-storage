"use client";

import axios from "axios";
import {
  Boxes,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Percent,
  RotateCcw,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { useOperationsCatalogOptions } from "../hooks/use-operations-catalog-options";
import { useOperationsUtilization } from "../hooks/use-operations-utilization";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { downloadCsv, formatDateTimeVn, formatPercentage } from "../operations.utils";
import { DASHBOARD_MESSAGES as D } from "../operations-dashboard.messages";
import { REPORTING_MESSAGES as R } from "../operations-reporting.messages";
import { REPORTS_MESSAGES as RM } from "../operations-reports.messages";
import { ChartLoadingSkeleton } from "./charts/chart-loading-skeleton";

const FacilityUtilizationBarChart = dynamic(
  () =>
    import("./charts/facility-utilization-bar-chart").then(
      (module) => module.FacilityUtilizationBarChart,
    ),
  { ssr: false, loading: () => <ChartLoadingSkeleton /> },
);

const PAGE_SIZE = 20;

export function OperationsUtilizationView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlFacilityId = searchParams.get("facilityId");
  const urlUnitTypeId = searchParams.get("unitTypeId");
  const urlPage = Number.parseInt(searchParams.get("page") ?? "1", 10);

  const [facilityId, setFacilityId] = useState(urlFacilityId ?? "all");
  const [unitTypeId, setUnitTypeId] = useState(urlUnitTypeId ?? "all");
  const [page, setPage] = useState(Number.isNaN(urlPage) || urlPage < 1 ? 1 : urlPage);

  const [showChart, setShowChart] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { facilities: catalogFacilities, unitTypes: catalogUnitTypes } =
    useOperationsCatalogOptions();

  // Sync state if URL changes (back/forward navigation)
  useEffect(() => {
    setFacilityId(urlFacilityId ?? "all");
    setUnitTypeId(urlUnitTypeId ?? "all");
    if (!Number.isNaN(urlPage) && urlPage >= 1) setPage(urlPage);
  }, [urlFacilityId, urlUnitTypeId, urlPage]);

  // Update URL search params when filters or page change
  function updateUrl(newParams: { facilityId?: string; unitTypeId?: string; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    const targetFacility = newParams.facilityId ?? facilityId;
    const targetUnitType = newParams.unitTypeId ?? unitTypeId;
    const targetPage = newParams.page ?? page;

    if (targetFacility && targetFacility !== "all") params.set("facilityId", targetFacility);
    else params.delete("facilityId");

    if (targetUnitType && targetUnitType !== "all") params.set("unitTypeId", targetUnitType);
    else params.delete("unitTypeId");

    if (targetPage > 1) params.set("page", String(targetPage));
    else params.delete("page");

    router.replace(`${routes.utilization}?${params.toString()}`);
  }

  const offset = (page - 1) * PAGE_SIZE;

  const query = useOperationsUtilization({
    facilityId,
    unitTypeId,
    limit: PAGE_SIZE,
    offset,
  });

  const { data, isPending, isError, refetch } = query;

  function handleFilterChange(updates: { facilityId?: string; unitTypeId?: string }) {
    if (updates.facilityId !== undefined) setFacilityId(updates.facilityId);
    if (updates.unitTypeId !== undefined) setUnitTypeId(updates.unitTypeId);
    setPage(1);
    updateUrl({ ...updates, page: 1 });
  }

  function resetFilters() {
    setFacilityId("all");
    setUnitTypeId("all");
    setPage(1);
    setExportError(null);
    updateUrl({ facilityId: "all", unitTypeId: "all", page: 1 });
  }

  async function handleExport() {
    try {
      setExporting(true);
      setExportError(null);
      const res = await api.reports.exportReport({
        type: "utilization",
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

  // Aggregate stats across items for the KPI cards
  const totalActive = data?.items.reduce((s, i) => s + i.metrics.activeUnits, 0) ?? 0;
  const totalOccupied = data?.items.reduce((s, i) => s + i.metrics.occupiedUnits, 0) ?? 0;
  const totalAvailable = data?.items.reduce((s, i) => s + i.metrics.availableUnits, 0) ?? 0;
  const totalMaintenance = data?.items.reduce((s, i) => s + i.metrics.maintenanceUnits, 0) ?? 0;
  const avgPercent = totalActive > 0 ? (totalOccupied / totalActive) * 100 : 0;

  return (
    <div className="flex min-w-0 flex-col gap-3 pb-3">
      {/* Compact Filter Toolbar */}
      <Card className="border-slate-200 bg-white p-2.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Facility Selector */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              <select
                value={facilityId}
                aria-label={D.filterFacility}
                onChange={(e) => handleFilterChange({ facilityId: e.target.value })}
                className="max-w-[150px] cursor-pointer truncate border-none bg-transparent p-0 text-xs font-medium text-slate-800 focus:outline-none sm:max-w-[180px]"
              >
                <option value="all">{M.allFacilities}</option>
                {catalogFacilities.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit Type Selector */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
              <Boxes className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              <select
                value={unitTypeId}
                aria-label={D.filterUnitType}
                onChange={(e) => handleFilterChange({ unitTypeId: e.target.value })}
                className="max-w-[140px] cursor-pointer truncate border-none bg-transparent p-0 text-xs font-medium text-slate-800 focus:outline-none"
              >
                <option value="all">{M.allUnitTypes}</option>
                {catalogUnitTypes.map((ut) => (
                  <option key={ut.unitTypeId} value={ut.unitTypeId}>
                    {ut.name}
                  </option>
                ))}
              </select>
            </div>

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

          {/* Export Button & Realtime Badge */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              loading={exporting}
              onClick={() => void handleExport()}
              className="h-7 min-h-0 gap-1 rounded-lg border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3 w-3 text-slate-500" aria-hidden="true" />
              <span>{M.export}</span>
            </Button>

            {data && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{D.asOfLabel(formatDateTimeVn(data.asOf))}</span>
              </div>
            )}
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
            {/* Card 1: Tổng ô khai thác */}
            <Card className="flex flex-col justify-between border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between gap-1 text-slate-500">
                <span className="text-xs font-medium">{RM.activeUnitsTotal}</span>
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                  <Boxes className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-1">
                <p className="text-lg font-bold tracking-tight text-slate-900">{totalActive} ô</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  Trên {data.total} cơ sở hoạt động
                </p>
              </div>
            </Card>

            {/* Card 2: Ô đang thuê */}
            <Card className="flex flex-col justify-between border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between gap-1 text-slate-500">
                <span className="text-xs font-medium">{RM.occupiedUnitsTotal}</span>
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-1">
                <p className="text-lg font-bold tracking-tight text-emerald-700">
                  {totalOccupied} ô
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  Đã bàn giao cho khách thuê
                </p>
              </div>
            </Card>

            {/* Card 3: Tỷ lệ khai thác TB */}
            <Card className="flex flex-col justify-between border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between gap-1 text-slate-500">
                <span className="text-xs font-medium">{RM.averageUtilization}</span>
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-[#165f4d]">
                  <Percent className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-1">
                <p className="text-lg font-bold tracking-tight text-slate-900">
                  {formatPercentage(avgPercent)}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {RM.unitBreakdown(totalAvailable, totalMaintenance)}
                </p>
              </div>
            </Card>

            {/* Card 4: Thời điểm cập nhật */}
            <Card className="flex flex-col justify-between border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between gap-1 text-slate-500">
                <span className="text-xs font-medium">{RM.asOfRealtime}</span>
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-1">
                <p className="text-xs font-bold tracking-tight text-slate-900 truncate">
                  {formatDateTimeVn(data.asOf)}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  Hiện trạng khai thác toàn hệ thống
                </p>
              </div>
            </Card>
          </div>

          {/* Collapsible Visual Analytics Bar Chart Card */}
          <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
            <button
              type="button"
              onClick={() => setShowChart(!showChart)}
              className="flex w-full cursor-pointer items-center justify-between p-3 text-left transition-colors hover:bg-slate-50/70"
            >
              <div className="flex items-center gap-2">
                {showChart ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
                )}
                <span className="text-xs font-bold text-slate-900">{R.utilization}</span>
                <Badge
                  variant="outline"
                  className="border-slate-200 py-0 text-[10px] font-normal text-slate-500"
                >
                  {M.showingFacilitiesCount(data.items.length, data.total)}
                </Badge>
              </div>
              <span className="text-xs font-medium text-slate-500 hover:text-slate-800">
                {showChart ? RM.chartToggleHide : RM.chartToggleShow}
              </span>
            </button>

            {showChart && (
              <div className="border-t border-slate-100 p-3 pt-2">
                <FacilityUtilizationBarChart items={data.items} totalFacilities={data.total} />
              </div>
            )}
          </Card>

          {/* Detailed Data Table */}
          <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-slate-200 bg-slate-50/90">
                  <TableRow className="hover:bg-transparent">
                    {R.capacityHeadings.map((heading) => (
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
                  {data.items.map(({ facility, metrics }) => {
                    const percent = metrics.utilizationPercent;
                    const isNull = percent === null;

                    return (
                      <TableRow
                        key={facility.id}
                        className="transition-colors hover:bg-slate-50/60"
                      >
                        <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs font-semibold text-slate-900">
                          {facility.name}
                          <span className="ml-1.5 font-mono text-xs font-normal text-slate-500">
                            ({facility.code})
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs tabular-nums text-slate-700">
                          {metrics.activeUnits}
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-3.5 py-2.5 text-xs tabular-nums text-slate-700">
                          {metrics.occupiedUnits}
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-3.5 py-2.5">
                          {isNull ? (
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-800"
                            >
                              {M.noOperatingUnitsBadge}
                            </Badge>
                          ) : (
                            <strong className="text-xs font-bold tabular-nums text-primary">
                              {formatPercentage(percent)}
                            </strong>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls with Direct Jump & Ellipsis Jump */}
            <div className="border-t border-slate-100 p-2.5">
              <ListPagination
                label={M.titles.utilization}
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
