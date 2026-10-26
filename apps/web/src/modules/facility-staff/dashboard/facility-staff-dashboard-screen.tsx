"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { FacilitySwitcher } from "@/features/facilities/facility-switcher";
import { useFacilityContext } from "@/features/facilities/use-facility-context";
import { FacilityOverview } from "@/features/facility-flow/facility-overview";
import { FLOW } from "@/features/facility-flow/flow.messages";
import { StaffWorkList } from "../staff-work-list";

export function FacilityStaffDashboardScreen() {
  return (
    <Suspense fallback={<LoadingState label={FLOW.loading} />}>
      <StaffDashboardContent />
    </Suspense>
  );
}

function StaffDashboardContent() {
  const view = useSearchParams().get("view");
  return view === "tasks" ? <StaffWorkList /> : <StaffOverview />;
}

function StaffOverview() {
  const scope = useFacilityContext();
  if (scope.isLoading) return <LoadingState label={FLOW.loading} variant="dashboard" />;
  if (scope.isError) return <ErrorState message={FLOW.error} onRetry={() => scope.refetch()} />;
  if (!scope.currentFacility)
    return <EmptyState title={FLOW.noFacility} description={FLOW.noBookingsHint} />;
  return (
    <div className="space-y-6">
      {scope.isMultiFacility && (
        <FacilitySwitcher
          activeAssignments={scope.activeAssignments}
          currentFacilityId={scope.currentFacilityId}
          onSwitchFacility={scope.switchFacility}
        />
      )}
      <FacilityOverview
        facilityId={scope.currentFacilityId}
        facilityName={scope.currentFacility.facilityName}
        staff
      />
    </div>
  );
}
