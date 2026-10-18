"use client";

import axios from "axios";
import { Download, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { FieldShell, Select } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useOperationsUtilization } from "../hooks/use-operations-utilization";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { downloadCsv, formatDateTimeVn, formatPercentage } from "../operations.utils";
import { FacilityUtilizationChart } from "./charts/facility-utilization-chart";
import { InventoryStatusChart } from "./charts/inventory-status-chart";

export function OperationsUtilizationView() {
  const [facilityId, setFacilityId] = useState("all");
  const [unitTypeId, setUnitTypeId] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const query = useOperationsUtilization({
    facilityId,
    unitTypeId,
    limit: 50,
    offset: 0,
  });

  const { data, isPending, isError, refetch } = query;

  if (isPending) return <LoadingState label={M.loading} />;
  if (isError || !data) {
    return <ErrorState message={M.error} onRetry={() => void refetch()} />;
  }

  const { summary, items, total, asOf } = data;

  function resetFilters() {
    setFacilityId("all");
    setUnitTypeId("all");
    setExportError(null);
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

  return (
    <div className="grid min-w-0 gap-6">
      {/* Header Back & Info */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="m-0 text-xs text-slate-500 font-medium">
            {M.asOfDisplay(formatDateTimeVn(asOf))}
          </p>
        </div>
        <Link href={routes.reports} className={buttonClassName("outline")}>
          {M.backReports}
        </Link>
      </div>

      {/* Filters Bar */}
      <section className="grid items-end gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)] sm:grid-cols-2 lg:grid-cols-4">
        <FieldShell label={M.facilityFilter}>
          <Select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
            <option value="all">{M.allFacilities}</option>
            {items.map((item) => (
              <option key={item.facility.id} value={item.facility.id}>
                {item.facility.name}
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

      {exportError && (
        <p
          role="alert"
          className="m-0 rounded-xl bg-rose-50 p-4 text-xs font-semibold text-rose-800 border border-rose-200"
        >
          {exportError}
        </p>
      )}

      {/* Summary KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
          <span className="text-xs font-semibold text-slate-600">Tỷ lệ khai thác hệ thống</span>
          <p className="my-2 text-2xl font-bold tabular-nums text-primary">
            {summary.utilizationPercent !== null ? (
              formatPercentage(summary.utilizationPercent)
            ) : (
              <span className="text-amber-700 text-lg">{M.noOperatingUnitsBadge}</span>
            )}
          </p>
          <p className="m-0 text-xs text-slate-500">
            {summary.occupiedUnits} / {summary.activeUnits} ô khai thác
          </p>
        </div>

        <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
          <span className="text-xs font-semibold text-slate-600">Ô khả dụng (Còn trống)</span>
          <p className="my-2 text-2xl font-bold tabular-nums text-emerald-700">
            {summary.availableUnits} ô
          </p>
          <p className="m-0 text-xs text-slate-500">Sẵn sàng nhận khách mới</p>
        </div>

        <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
          <span className="text-xs font-semibold text-slate-600">Ô đang bảo trì</span>
          <p className="my-2 text-2xl font-bold tabular-nums text-amber-700">
            {summary.maintenanceUnits} ô
          </p>
          <p className="m-0 text-xs text-slate-500">Vẫn thuộc mẫu số tính utilization</p>
        </div>

        <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
          <span className="text-xs font-semibold text-slate-600">Chờ nhận kho & Hold</span>
          <p className="my-2 text-2xl font-bold tabular-nums text-indigo-700">
            {summary.confirmedAwaitingHandover} / {summary.activeCheckoutHolds}
          </p>
          <p className="m-0 text-xs text-slate-500">Booking chờ nhận / Hold checkout</p>
        </div>
      </section>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FacilityUtilizationChart items={items} totalFacilities={total} />
        <InventoryStatusChart metrics={summary} />
      </div>

      {/* Detailed Table */}
      <section
        aria-label={M.titles.utilization}
        className="max-w-full overflow-x-auto rounded-card border border-outline-variant bg-surface-container-lowest shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]"
      >
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{M.titles.utilization}</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              {M.capacityHeadings.map((heading) => (
                <th key={heading} scope="col" className="whitespace-nowrap px-5 py-4 font-semibold">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(({ facility, metrics }) => (
              <tr key={facility.id} className="hover:bg-slate-50/50">
                <th scope="row" className="px-5 py-4 font-semibold text-ink whitespace-nowrap">
                  {facility.name} ({facility.code})
                </th>
                <td className="px-5 py-4 tabular-nums text-slate-700">{metrics.totalUnits}</td>
                <td className="px-5 py-4 tabular-nums font-semibold text-primary">
                  {metrics.occupiedUnits}
                </td>
                <td className="px-5 py-4 tabular-nums text-emerald-700 font-semibold">
                  {metrics.availableUnits}
                </td>
                <td className="px-5 py-4 tabular-nums text-amber-700 font-semibold">
                  {metrics.maintenanceUnits}
                </td>
                <td className="px-5 py-4 tabular-nums text-indigo-700">{metrics.reservedUnits}</td>
                <td className="px-5 py-4 tabular-nums font-bold whitespace-nowrap">
                  {metrics.utilizationPercent !== null ? (
                    <span
                      className={cn(
                        metrics.utilizationPercent < 40
                          ? "text-amber-700"
                          : metrics.utilizationPercent >= 80
                            ? "text-emerald-700"
                            : "text-primary",
                      )}
                    >
                      {formatPercentage(metrics.utilizationPercent)}
                    </span>
                  ) : (
                    <span className="rounded-xs bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                      {M.noOperatingUnitsBadge}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
