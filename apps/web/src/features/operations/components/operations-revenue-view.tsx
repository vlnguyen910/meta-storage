"use client";

import axios from "axios";
import { Download, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { FieldShell, Input, Select } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useOperationsRevenue } from "../hooks/use-operations-revenue";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { downloadCsv, formatDateTimeVn, formatMoney, getDefaultPeriod } from "../operations.utils";
import { FacilityRevenueChart } from "./charts/facility-revenue-chart";

export function OperationsRevenueView() {
  const defaultPeriod = getDefaultPeriod();
  const [from, setFrom] = useState(defaultPeriod.from);
  const [to, setTo] = useState(defaultPeriod.to);
  const [facilityId, setFacilityId] = useState("all");
  const [unitTypeId, setUnitTypeId] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const query = useOperationsRevenue({
    from,
    to,
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

  const { summary, items, unattributed, total, period, asOf } = data;

  function resetFilters() {
    const def = getDefaultPeriod();
    setFrom(def.from);
    setTo(def.to);
    setFacilityId("all");
    setUnitTypeId("all");
    setExportError(null);
  }

  async function handleExport() {
    try {
      setExporting(true);
      setExportError(null);
      const res = await api.reports.exportReport({
        type: "revenue",
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

  return (
    <div className="grid min-w-0 gap-6">
      {/* Header Back & Info */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500">
            {M.periodDisplay(period.from, period.to)}
          </p>
          <p className="m-0 text-xs text-slate-400">{M.asOfDisplay(formatDateTimeVn(asOf))}</p>
        </div>
        <Link href={routes.reports} className={buttonClassName("outline")}>
          {M.backReports}
        </Link>
      </div>

      {/* Filters Bar */}
      <section className="grid items-end gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)] sm:grid-cols-2 lg:grid-cols-5">
        <FieldShell label={M.fromDateLabel}>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to} />
        </FieldShell>
        <FieldShell label={M.toDateLabel}>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from} />
        </FieldShell>
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

      {/* KPI Cards in Period (Direct from summary) */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
          <span className="text-xs font-semibold text-slate-600">{M.cashReceivedLabel}</span>
          <p className="my-2 text-2xl font-bold tabular-nums text-ink">
            {formatMoney(summary.cashReceived)}
          </p>
          <p className="m-0 text-xs text-slate-500">
            {summary.paymentsReceivedCount} giao dịch thu nhận
          </p>
        </div>

        <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
          <span className="text-xs font-semibold text-slate-600">{M.rentalCollectedLabel}</span>
          <p className="my-2 text-2xl font-bold tabular-nums text-primary">
            {summary.rentalCollected !== null ? (
              formatMoney(summary.rentalCollected)
            ) : (
              <span className="text-amber-700 text-lg">{M.dataNeedsReconciliation}</span>
            )}
          </p>
          <p className="m-0 text-xs text-slate-500">Tiền thuê thuần trong kỳ</p>
        </div>

        <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
          <span className="text-xs font-semibold text-slate-600">{M.cashRefundedLabel}</span>
          <p className="my-2 text-2xl font-bold tabular-nums text-rose-600">
            {formatMoney(summary.cashRefunded)}
          </p>
          <p className="m-0 text-xs text-slate-500">Theo thời điểm refundedAt</p>
        </div>

        <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
          <span className="text-xs font-semibold text-slate-600">{M.netCashLabel}</span>
          <p
            className={cn(
              "my-2 text-2xl font-bold tabular-nums",
              Number.parseFloat(summary.netCash) < 0 ? "text-rose-600" : "text-emerald-700",
            )}
          >
            {formatMoney(summary.netCash)}
          </p>
          <p className="m-0 text-xs text-slate-500">Thực thu trừ tiền hoàn</p>
        </div>
      </section>

      {/* Revenue Chart */}
      <FacilityRevenueChart items={items} totalFacilities={total} />

      {/* Detailed Table */}
      <section
        aria-label={M.titles.revenue}
        className="max-w-full overflow-x-auto rounded-card border border-outline-variant bg-surface-container-lowest shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]"
      >
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{M.titles.revenue}</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              {M.revenueHeadings.map((heading) => (
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
                <td className="px-5 py-4 tabular-nums text-slate-700 whitespace-nowrap">
                  {metrics.rentalCollected !== null
                    ? formatMoney(metrics.rentalCollected)
                    : M.dataNeedsReconciliation}
                </td>
                <td className="px-5 py-4 tabular-nums text-slate-700 whitespace-nowrap">
                  {metrics.depositCollected !== null
                    ? formatMoney(metrics.depositCollected)
                    : M.dataNeedsReconciliation}
                </td>
                <td className="px-5 py-4 tabular-nums font-semibold text-ink whitespace-nowrap">
                  {formatMoney(metrics.cashReceived)}
                </td>
                <td className="px-5 py-4 tabular-nums font-semibold text-rose-600 whitespace-nowrap">
                  {formatMoney(metrics.cashRefunded)}
                </td>
                <td
                  className={cn(
                    "px-5 py-4 tabular-nums font-bold whitespace-nowrap",
                    Number.parseFloat(metrics.netCash) < 0 ? "text-rose-600" : "text-emerald-700",
                  )}
                >
                  {formatMoney(metrics.netCash)}
                </td>
              </tr>
            ))}

            {/* Unattributed row if present */}
            {unattributed && (
              <tr className="bg-amber-50/50 hover:bg-amber-50">
                <th
                  scope="row"
                  className="px-5 py-4 font-semibold text-amber-900 whitespace-nowrap"
                >
                  {M.unattributedLabel}
                </th>
                <td className="px-5 py-4 tabular-nums text-slate-700 whitespace-nowrap">
                  {unattributed.rentalCollected !== null
                    ? formatMoney(unattributed.rentalCollected)
                    : M.dataNeedsReconciliation}
                </td>
                <td className="px-5 py-4 tabular-nums text-slate-700 whitespace-nowrap">
                  {unattributed.depositCollected !== null
                    ? formatMoney(unattributed.depositCollected)
                    : M.dataNeedsReconciliation}
                </td>
                <td className="px-5 py-4 tabular-nums font-semibold text-ink whitespace-nowrap">
                  {formatMoney(unattributed.cashReceived)}
                </td>
                <td className="px-5 py-4 tabular-nums font-semibold text-rose-600 whitespace-nowrap">
                  {formatMoney(unattributed.cashRefunded)}
                </td>
                <td
                  className={cn(
                    "px-5 py-4 tabular-nums font-bold whitespace-nowrap",
                    Number.parseFloat(unattributed.netCash) < 0
                      ? "text-rose-600"
                      : "text-emerald-700",
                  )}
                >
                  {formatMoney(unattributed.netCash)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
