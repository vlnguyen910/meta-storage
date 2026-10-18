"use client";

import { AlertCircle, ArrowRight, CheckCircle2, Clock, RotateCcw, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { FieldShell, Input, Select } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { useOperationsOverview } from "../hooks/use-operations-overview";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import {
  formatDateTimeVn,
  formatMoney,
  formatPercentage,
  getDefaultPeriod,
} from "../operations.utils";
import { FacilityUtilizationChart } from "./charts/facility-utilization-chart";
import { InventoryStatusChart } from "./charts/inventory-status-chart";

export function OperationsDashboardView() {
  const defaultPeriod = getDefaultPeriod();
  const [from, setFrom] = useState(defaultPeriod.from);
  const [to, setTo] = useState(defaultPeriod.to);
  const [facilityId, setFacilityId] = useState("all");
  const [unitTypeId, setUnitTypeId] = useState("all");

  const query = useOperationsOverview({
    from,
    to,
    facilityId,
    unitTypeId,
  });

  const { data, isPending, isError, refetch } = query;

  if (isPending) return <LoadingState label={M.loading} />;
  if (isError || !data) {
    return <ErrorState message={M.error} onRetry={() => void refetch()} />;
  }

  const { summary, attention, facilities, asOf, period, total } = data;
  const { financial, inventory } = summary;

  function resetFilters() {
    const def = getDefaultPeriod();
    setFrom(def.from);
    setTo(def.to);
    setFacilityId("all");
    setUnitTypeId("all");
  }

  return (
    <div className="grid min-w-0 gap-6">
      {/* Filters bar */}
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
            {facilities.map((item) => (
              <option key={item.facility.id} value={item.facility.id}>
                {item.facility.name}
              </option>
            ))}
          </Select>
        </FieldShell>
        <div className="flex items-center gap-2 sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            icon={<RotateCcw size={16} aria-hidden="true" />}
            onClick={resetFilters}
          >
            {M.reset}
          </Button>
          <div className="ml-auto text-xs text-slate-500 font-medium">
            {M.periodDisplay(period.from, period.to)}
          </div>
        </div>
      </section>

      {/* KPI Section 1: Financial in Period */}
      <section className="grid min-w-0 gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-ink">Kết quả tài chính trong kỳ</h2>
          <span className="text-xs text-slate-500">{M.netCashHelp}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Cash Received */}
          <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
            <span className="text-xs font-semibold text-slate-600">{M.cashReceivedLabel}</span>
            <p className="my-2 text-2xl font-bold tabular-nums text-ink">
              {formatMoney(financial.cashReceived)}
            </p>
            <p className="m-0 text-xs text-slate-500">
              {financial.paymentsReceivedCount} giao dịch thanh toán
            </p>
          </div>

          {/* Rental Collected */}
          <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
            <span className="text-xs font-semibold text-slate-600">{M.rentalCollectedLabel}</span>
            <p className="my-2 text-2xl font-bold tabular-nums text-primary">
              {financial.rentalCollected !== null ? (
                formatMoney(financial.rentalCollected)
              ) : (
                <span className="text-amber-700 text-lg">{M.dataNeedsReconciliation}</span>
              )}
            </p>
            {financial.rentalCollected === null ? (
              <Link
                href={`${routes.reports}?tab=reconciliation`}
                className="text-xs text-amber-700 underline font-medium"
              >
                {M.reconciliationLinkText}
              </Link>
            ) : (
              <p className="m-0 text-xs text-slate-500">Tiền thuê thuần (tách biệt cọc)</p>
            )}
          </div>

          {/* Cash Refunded */}
          <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
            <span className="text-xs font-semibold text-slate-600">{M.cashRefundedLabel}</span>
            <p className="my-2 text-2xl font-bold tabular-nums text-rose-600">
              {formatMoney(financial.cashRefunded)}
            </p>
            <p className="m-0 text-xs text-slate-500">Theo thời điểm hoàn thực tế</p>
          </div>

          {/* Net Cash */}
          <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
            <span className="text-xs font-semibold text-slate-600">{M.netCashLabel}</span>
            <p
              className={cn(
                "my-2 text-2xl font-bold tabular-nums",
                Number.parseFloat(financial.netCash) < 0 ? "text-rose-600" : "text-emerald-700",
              )}
            >
              {formatMoney(financial.netCash)}
            </p>
            <p className="m-0 text-xs text-slate-500">Thực thu trừ tiền đã hoàn</p>
          </div>
        </div>
      </section>

      {/* KPI Section 2: Snapshot at asOf */}
      <section className="grid min-w-0 gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-ink">Số dư cọc & Sức chứa kho (Hiện trạng)</h2>
          <span className="text-xs text-slate-500 font-medium">
            {M.asOfDisplay(formatDateTimeVn(asOf))}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-card border border-outline-variant bg-slate-50 p-5">
            <span className="text-xs font-semibold text-slate-600">{M.depositHeldLabel}</span>
            <p className="my-2 text-2xl font-bold tabular-nums text-ink">
              {financial.depositHeld !== null ? (
                formatMoney(financial.depositHeld)
              ) : (
                <span className="text-amber-700 text-lg">{M.dataNeedsReconciliation}</span>
              )}
            </p>
            <p className="m-0 text-xs text-slate-500">{M.depositHeldExplanation}</p>
          </div>

          <div className="rounded-card border border-outline-variant bg-slate-50 p-5">
            <span className="text-xs font-semibold text-slate-600">{M.depositForfeitedLabel}</span>
            <p className="my-2 text-2xl font-bold tabular-nums text-slate-800">
              {formatMoney(financial.depositForfeited)}
            </p>
            <p className="m-0 text-xs text-slate-500">Cọc giữ lại do vi phạm hợp đồng</p>
          </div>

          <div className="rounded-card border border-outline-variant bg-slate-50 p-5">
            <span className="text-xs font-semibold text-slate-600">
              Tỷ lệ sử dụng toàn hệ thống
            </span>
            <p className="my-2 text-2xl font-bold tabular-nums text-primary">
              {inventory.utilizationPercent !== null ? (
                formatPercentage(inventory.utilizationPercent)
              ) : (
                <span className="text-amber-700 text-lg">{M.noOperatingUnitsBadge}</span>
              )}
            </p>
            <p className="m-0 text-xs text-slate-500">
              {inventory.occupiedUnits} đang dùng / {inventory.activeUnits} ô khai thác
            </p>
          </div>

          <div className="rounded-card border border-outline-variant bg-slate-50 p-5">
            <span className="text-xs font-semibold text-slate-600">Ô khả dụng & Bảo trì</span>
            <p className="my-2 text-2xl font-bold tabular-nums text-emerald-700">
              {inventory.availableUnits} trống /{" "}
              <span className="text-amber-700">{inventory.maintenanceUnits} bảo trì</span>
            </p>
            <p className="m-0 text-xs text-slate-500">
              {inventory.activeCheckoutHolds} hold, {inventory.confirmedAwaitingHandover} chờ nhận
              kho
            </p>
          </div>
        </div>
      </section>

      {/* Attention Area (Khu vực cần chú ý) */}
      <section className="rounded-card border border-amber-200 bg-amber-50/40 p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
        <h2 className="text-base font-bold text-amber-950 mb-3 flex items-center gap-2">
          <AlertCircle size={18} className="text-amber-600" aria-hidden="true" />
          {M.attentionHeader}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Refunds */}
          <div className="rounded-lg border border-amber-200 bg-white p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs mb-1">
                <Clock size={15} />
                <span>Hoàn tiền chờ xử lý</span>
              </div>
              <p className="text-sm text-slate-700 font-medium">
                {M.pendingRefundsAttention(
                  attention.refunds.count,
                  formatMoney(attention.refunds.amount),
                )}
              </p>
            </div>
            <Link
              href={`${routes.reports}?tab=refunds`}
              className={cn(buttonClassName("outline"), "mt-3 text-xs w-full justify-center")}
            >
              {M.actionManageRefunds}
            </Link>
          </div>

          {/* Underutilized Facilities */}
          <div className="rounded-lg border border-amber-200 bg-white p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs mb-1">
                <CheckCircle2 size={15} />
                <span>Cơ sở ít khai thác</span>
              </div>
              <p className="text-sm text-slate-700 font-medium">
                {M.vacantCapacityAttention(attention.vacantCapacity.count)}
              </p>
            </div>
            <Link
              href={routes.utilization}
              className={cn(buttonClassName("outline"), "mt-3 text-xs w-full justify-center")}
            >
              {M.actionViewUtilization}
            </Link>
          </div>

          {/* Maintenance */}
          <div className="rounded-lg border border-amber-200 bg-white p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs mb-1">
                <Wrench size={15} />
                <span>Ô đang bảo trì</span>
              </div>
              <p className="text-sm text-slate-700 font-medium">
                {M.maintenanceAttention(attention.maintenance.count)}
              </p>
            </div>
            <Link
              href={routes.utilization}
              className={cn(buttonClassName("outline"), "mt-3 text-xs w-full justify-center")}
            >
              {M.actionViewUtilization}
            </Link>
          </div>

          {/* Data Quality */}
          <div className="rounded-lg border border-amber-200 bg-white p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs mb-1">
                <AlertCircle size={15} />
                <span>Chất lượng dữ liệu</span>
              </div>
              <p className="text-sm text-slate-700 font-medium">
                {attention.dataQuality.hasIssues
                  ? attention.dataQuality.description
                  : "Dữ liệu đối chiếu hoàn chỉnh, không có cảnh báo"}
              </p>
            </div>
            {attention.dataQuality.hasIssues && (
              <Link
                href={`${routes.reports}?tab=reconciliation`}
                className={cn(buttonClassName("outline"), "mt-3 text-xs w-full justify-center")}
              >
                {M.actionViewReconciliation}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Charts & Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FacilityUtilizationChart
          items={facilities.map((item) => ({
            facility: item.facility,
            metrics: item.inventory,
          }))}
          totalFacilities={total}
        />
        <InventoryStatusChart metrics={inventory} />
      </div>

      {/* Navigation Quick Links to Full Reports */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={routes.revenue}
          className="flex items-center justify-between rounded-card border border-outline-variant bg-surface-container-lowest p-5 transition-shadow hover:shadow-md"
        >
          <div>
            <h3 className="text-base font-bold text-primary">{M.titles.revenue}</h3>
            <p className="m-0 text-xs text-slate-600 mt-1">{M.reportCards.revenue}</p>
          </div>
          <ArrowRight size={20} className="text-primary shrink-0 ml-3" />
        </Link>
        <Link
          href={routes.utilization}
          className="flex items-center justify-between rounded-card border border-outline-variant bg-surface-container-lowest p-5 transition-shadow hover:shadow-md"
        >
          <div>
            <h3 className="text-base font-bold text-primary">{M.titles.utilization}</h3>
            <p className="m-0 text-xs text-slate-600 mt-1">{M.reportCards.utilization}</p>
          </div>
          <ArrowRight size={20} className="text-primary shrink-0 ml-3" />
        </Link>
      </div>
    </div>
  );
}
