"use client";

import axios from "axios";
import { ChevronLeft, ChevronRight, Download, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldShell, Input, Select } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useOperationsCatalogOptions } from "../hooks/use-operations-catalog-options";
import { useOperationsMonthlyRevenue } from "../hooks/use-operations-monthly-revenue";
import { useOperationsRevenue } from "../hooks/use-operations-revenue";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { downloadCsv, formatMoney, getDefaultPeriod } from "../operations.utils";
import { REPORTING_MESSAGES as R } from "../operations-reporting.messages";
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

  // Filter Bar Component that stays accessible even if data request fails
  const filtersBar = (
    <section className="grid items-end gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)] sm:grid-cols-2 lg:grid-cols-5">
      <FieldShell label={M.fromDateLabel}>
        <Input
          type="date"
          value={from}
          onChange={(e) => handleFilterChange({ from: e.target.value })}
          max={to}
        />
      </FieldShell>
      <FieldShell label={M.toDateLabel}>
        <Input
          type="date"
          value={to}
          onChange={(e) => handleFilterChange({ to: e.target.value })}
          min={from}
        />
      </FieldShell>
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
      <div className="flex flex-wrap items-center gap-2">
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
          onClick={() => void handleExport()}
        >
          {R.facilityCsv}
        </Button>
        <Button
          type="button"
          variant="outline"
          loading={exporting}
          onClick={() => void handleExport("revenue-monthly")}
        >
          {R.monthlyCsv}
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
          <OperationsFinancialChart metrics={data.summary} />
          {monthly.isPending ? (
            <LoadingState label={M.loading} variant="table" />
          ) : monthly.isError || !monthly.data ? (
            <ErrorState message={M.error} onRetry={() => void monthly.refetch()} />
          ) : (
            <MonthlyRevenueChart report={monthly.data} />
          )}

          {/* Recharts Revenue Chart */}
          <FacilityRevenueChart items={data.items} totalFacilities={data.total} />

          {/* Detailed Table */}
          <section
            aria-label={M.titles.revenue}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Make the horizontally scrollable data table keyboard accessible.
            tabIndex={0}
            className="max-w-full overflow-x-auto rounded-card border border-outline-variant bg-surface-container-lowest shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]"
          >
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">{M.titles.revenue}</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  {R.facilityRevenueHeadings.map((heading) => (
                    <th key={heading} scope="col" className="px-5 py-3 text-xs font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map(({ facility, metrics }) => (
                  <tr key={facility.id} className="hover:bg-slate-50/50">
                    <th scope="row" className="px-5 py-4 font-semibold text-ink whitespace-nowrap">
                      {facility.name}
                      <span className="ml-1.5 font-mono text-xs text-slate-500 font-normal">
                        ({facility.code})
                      </span>
                    </th>
                    <td className="px-5 py-4 font-bold tabular-nums text-ink whitespace-nowrap">
                      {formatMoney(metrics.cashReceived)}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-slate-700 whitespace-nowrap">
                      {metrics.rentalCollected !== null ? (
                        formatMoney(metrics.rentalCollected)
                      ) : (
                        <span className="rounded-xs bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                          {M.dataNeedsReconciliation}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-slate-700 whitespace-nowrap">
                      {formatMoney(metrics.depositCollected)}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-rose-600 whitespace-nowrap font-medium">
                      {formatMoney(metrics.cashRefunded)}
                    </td>
                    <td
                      className={cn(
                        "px-5 py-4 font-bold tabular-nums whitespace-nowrap",
                        Number.parseFloat(metrics.netCash) < 0
                          ? "text-rose-600"
                          : "text-emerald-700",
                      )}
                    >
                      {formatMoney(metrics.netCash)}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-slate-700 whitespace-nowrap">
                      {metrics.depositHeld !== null ? (
                        formatMoney(metrics.depositHeld)
                      ) : (
                        <span className="text-xs text-amber-700">{M.dataNeedsReconciliation}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-slate-600 whitespace-nowrap">
                      {formatMoney(metrics.depositForfeited)}
                    </td>
                  </tr>
                ))}

                {/* Unattributed row if present */}
                {data.unattributed && (
                  <tr className="bg-amber-50/30 border-t-2 border-amber-200">
                    <th
                      scope="row"
                      className="px-5 py-4 font-bold text-amber-900 whitespace-nowrap"
                    >
                      {M.unattributedLabel}
                    </th>
                    <td className="px-5 py-4 font-bold tabular-nums text-amber-950 whitespace-nowrap">
                      {formatMoney(data.unattributed.cashReceived)}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-amber-900 whitespace-nowrap">
                      {data.unattributed.rentalCollected !== null ? (
                        formatMoney(data.unattributed.rentalCollected)
                      ) : (
                        <span className="rounded-xs bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300">
                          {M.dataNeedsReconciliation}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-amber-900 whitespace-nowrap">
                      {formatMoney(data.unattributed.depositCollected)}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-rose-700 whitespace-nowrap font-medium">
                      {formatMoney(data.unattributed.cashRefunded)}
                    </td>
                    <td className="px-5 py-4 font-bold tabular-nums text-amber-950 whitespace-nowrap">
                      {formatMoney(data.unattributed.netCash)}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-amber-900 whitespace-nowrap">
                      {data.unattributed.depositHeld !== null ? (
                        formatMoney(data.unattributed.depositHeld)
                      ) : (
                        <span className="text-xs text-amber-700">{M.dataNeedsReconciliation}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-amber-900 whitespace-nowrap">
                      {formatMoney(data.unattributed.depositForfeited)}
                    </td>
                  </tr>
                )}
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
