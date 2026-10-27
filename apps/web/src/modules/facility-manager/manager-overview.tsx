"use client";
import {
  ArrowRight,
  ChartNoAxesCombined,
  DoorOpen,
  RefreshCw,
  UsersRound,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { InventoryStatusChart } from "@/features/operations/components/charts/inventory-status-chart";
import { MonthlyRevenueChart } from "@/features/operations/components/charts/monthly-revenue-chart";
import { ManagerReportsPanel } from "./manager-reports-screen";
import { MANAGER_TABS as REPORTS } from "./manager-tabs.messages";
import { MANAGER_WORKSPACE as M } from "./manager-workspace.messages";
import type { ManagerOverviewProps } from "./manager-workspace.types";
import { useManagerOverview } from "./use-manager-overview";

export function ManagerOverview({ facilityId }: ManagerOverviewProps) {
  const { overview, monthly } = useManagerOverview(facilityId);
  if (overview.isPending)
    return (
      <div className="space-y-6 pt-5">
        <h1 className="text-3xl font-bold">{M.overview}</h1>
        <LoadingState variant="dashboard" />
      </div>
    );
  if (overview.isError)
    return (
      <div className="space-y-6 pt-5">
        <h1 className="text-3xl font-bold">{M.overview}</h1>
        <ErrorState message={M.overviewError} onRetry={() => overview.refetch()} />
      </div>
    );
  const units = overview.data.summary.inventory;
  const points = monthly.data?.items ?? [];
  const panels = "rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6";
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 pt-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">{M.scoped}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{M.overview}</h1>
          <p className="mt-2 text-sm text-slate-600">{M.overviewHint}</p>
        </div>
        <Button
          variant="outline"
          disabled={overview.isFetching || monthly.isFetching}
          onClick={() => {
            void overview.refetch();
            void monthly.refetch();
          }}
        >
          <RefreshCw size={16} />
          {M.refresh}
        </Button>
      </header>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: M.total, value: units.totalUnits, icon: Warehouse },
          { label: M.available, value: units.availableUnits, icon: DoorOpen },
          { label: M.occupied, value: units.occupiedUnits, icon: UsersRound },
          {
            label: M.utilization,
            value: units.utilizationPercent === null ? "—" : `${units.utilizationPercent}%`,
            icon: ChartNoAxesCombined,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className={panels}>
            <div className="flex items-center justify-between gap-2 text-sm text-slate-600">
              <span>{label}</span>
              <Icon size={19} className="shrink-0 text-emerald-800" aria-hidden="true" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-5">
        <div>
          {monthly.isPending ? (
            <LoadingState variant="table" />
          ) : monthly.isError ? (
            <ErrorState message={M.revenueError} onRetry={() => monthly.refetch()} />
          ) : points.length === 0 ? (
            <EmptyState title={M.emptyRevenue} description={M.incomeHint} />
          ) : (
            <MonthlyRevenueChart report={monthly.data} />
          )}
        </div>
        <InventoryStatusChart metrics={units} title="Cơ cấu trạng thái ô kho tại cơ sở" />
      </div>
      <section id="manager-reports" className="scroll-mt-6 space-y-4">
        <header>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{REPORTS.reports}</h2>
          <p className="mt-2 text-sm text-slate-600">{REPORTS.reportHint}</p>
        </header>
        <ManagerReportsPanel facilityId={facilityId} />
      </section>
      <section className={panels}>
        <h2 className="text-lg font-bold">{M.attention}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { href: "/facility-manager/tasks?view=bookings", label: M.prepare },
            { href: "/facility-manager/tasks?view=reports", label: M.accept },
            { href: "/facility-manager/storage-units", label: M.units },
            { href: "/facility-manager/staff", label: M.people },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-100"
            >
              {item.label}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
