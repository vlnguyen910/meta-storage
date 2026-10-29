"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { FacilitySwitcher } from "@/features/facilities/facility-switcher";
import { useFacilityContext } from "@/features/facilities/use-facility-context";
import { ManagerOverview } from "../manager-overview";
import { FACILITY_DASHBOARD_MESSAGES as M } from "./facility-dashboard.messages";
export function FacilityManagerDashboardScreen() {
  return (
    <Suspense fallback={<LoadingState variant="dashboard" />}>
      <FacilityManagerDashboardContent />
    </Suspense>
  );
}
function FacilityManagerDashboardContent() {
  const view = useSearchParams().get("view");
  const router = useRouter();
  const destination =
    view === "staff"
      ? "/facility-manager/staff"
      : view === "check-in"
        ? "/facility-manager/tasks?view=appointments"
        : null;
  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);
  const scope = useFacilityContext();
  if (destination || scope.isLoading) return <LoadingState variant="dashboard" />;
  if (scope.isError)
    return <ErrorState message={M.errorLoadFacility} onRetry={() => scope.refetch()} />;
  if (!scope.currentFacility)
    return <EmptyState title={M.noAssignmentTitle} description={M.noAssignmentDescription} />;
  return (
    <div className="space-y-6">
      {scope.isMultiFacility && (
        <FacilitySwitcher
          activeAssignments={scope.activeAssignments}
          currentFacilityId={scope.currentFacilityId}
          onSwitchFacility={scope.switchFacility}
        />
      )}
      <ManagerOverview key={scope.currentFacilityId} facilityId={scope.currentFacilityId} />
    </div>
  );
}
