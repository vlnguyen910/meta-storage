"use client";

import axios from "axios";
import { ChevronLeft, ChevronRight, Download, RotateCcw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldShell, Select } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { api } from "@/lib/api";
import { useOperationsCatalogOptions } from "../hooks/use-operations-catalog-options";
import { useOperationsUtilization } from "../hooks/use-operations-utilization";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { downloadCsv, formatDateTimeVn, formatPercentage } from "../operations.utils";
import { REPORTING_MESSAGES as R } from "../operations-reporting.messages";
import { FacilityUtilizationBarChart } from "./charts/facility-utilization-bar-chart";

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
        <LoadingState label={M.loading} />
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
          <section
            aria-label={M.titles.utilization}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Make the horizontally scrollable data table keyboard accessible.
            tabIndex={0}
            className="max-w-full overflow-x-auto rounded-card border border-outline-variant bg-surface-container-lowest shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]"
          >
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">{M.titles.utilization}</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  {R.capacityHeadings.map((heading) => (
                    <th key={heading} scope="col" className="px-5 py-3 text-xs font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map(({ facility, metrics }) => {
                  const percent = metrics.utilizationPercent;
                  const isNull = percent === null;

                  return (
                    <tr key={facility.id} className="hover:bg-slate-50/50">
                      <th
                        scope="row"
                        className="px-5 py-4 font-semibold text-ink whitespace-nowrap"
                      >
                        {facility.name}
                        <span className="ml-1.5 font-mono text-xs text-slate-500 font-normal">
                          ({facility.code})
                        </span>
                      </th>
                      <td className="px-5 py-4 tabular-nums">{metrics.activeUnits}</td>
                      <td className="px-5 py-4 tabular-nums">{metrics.occupiedUnits}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {isNull ? (
                          <span className="rounded-xs bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                            {M.noOperatingUnitsBadge}
                          </span>
                        ) : (
                          <strong className="text-primary tabular-nums font-bold">
                            {formatPercentage(percent)}
                          </strong>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* Pagination Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-2 text-xs text-slate-600">
            <div>
              Hiển thị {data.items.length > 0 ? offset + 1 : 0} –{" "}
              {Math.min(offset + data.items.length, data.total)} trong tổng số{" "}
              <strong>{data.total}</strong> cơ sở
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() => {
                  const newPage = page - 1;
                  setPage(newPage);
                  updateUrl({ page: newPage });
                }}
                className="h-8 px-2.5 text-xs"
              >
                <ChevronLeft size={14} aria-hidden="true" />
                <span>Trang trước</span>
              </Button>
              <span className="font-semibold text-ink px-2">
                Trang {page} / {Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={offset + data.items.length >= data.total}
                onClick={() => {
                  const newPage = page + 1;
                  setPage(newPage);
                  updateUrl({ page: newPage });
                }}
                className="h-8 px-2.5 text-xs"
              >
                <span>Trang sau</span>
                <ChevronRight size={14} aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
