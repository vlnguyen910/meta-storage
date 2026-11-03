"use client";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OperationalPageHeader } from "@/components/ui/operational";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { InventoryStatusChart } from "@/features/operations/components/charts/inventory-status-chart";
import { MonthlyRevenueChart } from "@/features/operations/components/charts/monthly-revenue-chart";
import { MANAGER_WORKSPACE as M } from "./manager-workspace.messages";
import type { ManagerOverviewProps } from "./manager-workspace.types";
import { useManagerOverview } from "./use-manager-overview";

export function ManagerOverview({ facilityId }: ManagerOverviewProps) {
  const { overview, monthly } = useManagerOverview(facilityId);

  if (overview.isPending || monthly.isPending)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{M.overview}</h1>
        <LoadingState variant="dashboard" />
      </div>
    );

  if (overview.isError)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{M.overview}</h1>
        <ErrorState message={M.overviewError} onRetry={() => overview.refetch()} />
      </div>
    );

  if (monthly.isError)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{M.overview}</h1>
        <ErrorState message={M.revenueError} onRetry={() => monthly.refetch()} />
      </div>
    );

  const units = overview.data.summary.inventory;
  const points = monthly.data?.items ?? [];

  return (
    <div className="space-y-4">
      <OperationalPageHeader
        title={M.overview}
        description={M.overviewHint}
        eyebrow={M.scoped}
        action={
          <Button
            variant="outline"
            disabled={overview.isFetching || monthly.isFetching}
            onClick={() => {
              void overview.refetch();
              void monthly.refetch();
            }}
            className="h-9 px-3 text-xs gap-1.5 shadow-2xs"
          >
            <RefreshCw
              size={14}
              className={
                overview.isFetching || monthly.isFetching ? "animate-spin text-primary" : ""
              }
            />
            {M.refresh}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Cột 1: Doanh thu theo tháng */}
        <div className="min-w-0">
          {points.length === 0 ? (
            <EmptyState title={M.emptyRevenue} description={M.incomeHint} />
          ) : (
            <MonthlyRevenueChart report={monthly.data} />
          )}
        </div>

        {/* Cột 2: Trạng thái ô kho */}
        <div className="min-w-0">
          <InventoryStatusChart metrics={units} title={M.inventory} />
        </div>
      </div>
    </div>
  );
}
