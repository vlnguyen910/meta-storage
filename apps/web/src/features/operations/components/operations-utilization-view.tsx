"use client";

import axios from "axios";
import { Download, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldShell, Select } from "@/components/ui/form-controls";
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
import { REPORTING_MESSAGES as R } from "../operations-reporting.messages";
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

  // Filter Bar Component that stays accessible even if data request fails
  const filtersBar = (
    <section className="grid items-end gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)] sm:grid-cols-2 lg:grid-cols-4">
      <FieldShell label={M.facilityFilter}>
        <Select
          value={facilityId}
          onChange={(e) => handleFilterChange({ facilityId: e.target.value })}
        >
          <option value="all">{M.allFacilities}</option>
          {catalogFacilities.map((fac) => (
            <option key={fac.id} value={fac.id}>
              {fac.name}
            </option>
          ))}
        </Select>
      </FieldShell>
      <FieldShell label={M.unitTypeFilter}>
        <Select
          value={unitTypeId}
          onChange={(e) => handleFilterChange({ unitTypeId: e.target.value })}
        >
          <option value="all">{M.allUnitTypes}</option>
          {catalogUnitTypes.map((ut) => (
            <option key={ut.unitTypeId} value={ut.unitTypeId}>
              {ut.name}
            </option>
          ))}
        </Select>
      </FieldShell>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <Button
          type="button"
          variant="outline"
          icon={<RotateCcw size={16} aria-hidden="true" />}
          onClick={resetFilters}
        >
          {M.reset}
        </Button>
        <Button
          type="button"
          loading={exporting}
          icon={<Download size={16} aria-hidden="true" />}
          onClick={handleExport}
        >
          {M.export}
        </Button>
      </div>
    </section>
  );

  return (
    <div className="grid min-w-0 gap-6">
      {/* Filters Bar */}
      {filtersBar}

      {/* Selected Facility Context Banner */}
      {selectedFacilityName && (
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-primary">
          <span>
            Đang lọc theo cơ sở: <strong>{selectedFacilityName}</strong>
          </span>
          <button
            type="button"
            onClick={() => handleFilterChange({ facilityId: "all" })}
            className="font-bold underline hover:text-primary-dark"
          >
            Xóa lọc cơ sở
          </button>
        </div>
      )}

      {exportError && (
        <p
          role="alert"
          className="m-0 rounded-xl bg-rose-50 p-4 text-xs font-semibold text-rose-800 border border-rose-200"
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
          {/* AsOf Snapshot Header */}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-ink">{R.currentScope}</h2>
            <span className="text-xs text-slate-500 font-medium">
              {M.asOfDisplay(formatDateTimeVn(data.asOf))}
            </span>
          </div>

          {/* Recharts Charts Grid */}
          <FacilityUtilizationBarChart items={data.items} totalFacilities={data.total} />

          {/* Detailed Table */}
          <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/95 border-b border-slate-200">
                <TableRow className="hover:bg-transparent">
                  {R.capacityHeadings.map((heading) => (
                    <TableHead
                      key={heading}
                      className="px-4 py-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap"
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
                    <TableRow key={facility.id} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell className="px-4 py-2.5 font-semibold text-xs text-slate-900 whitespace-nowrap">
                        {facility.name}
                        <span className="ml-1.5 font-mono text-xs text-slate-500 font-normal">
                          ({facility.code})
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 tabular-nums text-xs text-slate-700 whitespace-nowrap">
                        {metrics.activeUnits}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 tabular-nums text-xs text-slate-700 whitespace-nowrap">
                        {metrics.occupiedUnits}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 whitespace-nowrap">
                        {isNull ? (
                          <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] px-1.5 py-0.2">
                            {M.noOperatingUnitsBadge}
                          </Badge>
                        ) : (
                          <strong className="text-primary tabular-nums text-xs font-bold">
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

          {/* Pagination Controls with Direct Jump */}
          <div className="pt-1">
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
        </>
      )}
    </div>
  );
}
