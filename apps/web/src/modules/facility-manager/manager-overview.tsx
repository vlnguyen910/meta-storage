"use client";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OperationalPageHeader } from "@/components/ui/operational";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { MonthlyRevenueChart } from "@/features/operations/components/charts/monthly-revenue-chart";
import { MANAGER_WORKSPACE as M } from "./manager-workspace.messages";
import type { ManagerOverviewProps } from "./manager-workspace.types";
import { useManagerOverview } from "./use-manager-overview";

export function ManagerOverview({ facilityId }: ManagerOverviewProps) {
  const { overview, monthly } = useManagerOverview(facilityId);

  if (monthly.isPending)
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{M.overview}</h1>
        <LoadingState variant="dashboard" />
      </div>
    );

  if (monthly.isError)
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{M.overview}</h1>
        <ErrorState message={M.revenueError} onRetry={() => monthly.refetch()} />
      </div>
    );

  const points = monthly.data?.items ?? [];

  return (
    <div className="space-y-6">
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
          >
            <RefreshCw size={16} />
            {M.refresh}
          </Button>
        }
      />

      <div>
        {points.length === 0 ? (
          <EmptyState title={M.emptyRevenue} description={M.incomeHint} />
        ) : (
          <MonthlyRevenueChart report={monthly.data} />
        )}
      </div>
    </div>
  );
}
