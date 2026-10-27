"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { FacilityBookingsView } from "@/features/check-in/facility-bookings-view";
import { FacilitySwitcher } from "@/features/facilities/facility-switcher";
import { useFacilityContext } from "@/features/facilities/use-facility-context";
import { FacilityOverview } from "@/features/facility-flow/facility-overview";
import { FLOW } from "@/features/facility-flow/flow.messages";
import { FACILITY_DASHBOARD_MESSAGES as M } from "./facility-dashboard.messages";
import { FacilityStaffTab } from "./facility-staff-tab";

export function FacilityManagerDashboardScreen() {
  return (
    <Suspense fallback={<LoadingState label={FLOW.loading} />}>
      <FacilityManagerDashboardContent />
    </Suspense>
  );
}
function FacilityManagerDashboardContent() {
  const view = useSearchParams().get("view");
  const activeTab = view === "check-in" || view === "staff" ? view : "overview";
  const {
    currentFacility: assignment,
    activeAssignments,
    currentFacilityId,
    switchFacility,
    isLoading,
    isError,
    refetch,
  } = useFacilityContext();

  return (
    <div className="space-y-6">
      <FacilitySwitcher
        activeAssignments={activeAssignments}
        currentFacilityId={currentFacilityId}
        onSwitchFacility={switchFacility}
      />
      <nav className="flex flex-wrap gap-2" aria-label={M.navigationLabel}>
        {(["check-in", "overview", "staff"] as const).map((tab) => (
          <Link
            key={tab}
            href={`?view=${tab}`}
            aria-current={activeTab === tab ? "page" : undefined}
            className={`rounded px-4 py-2 text-sm font-semibold ${activeTab === tab ? "bg-primary text-white" : "bg-white text-[#404945]"}`}
          >
            {tab === "check-in" ? M.tabCheckIn : tab === "overview" ? M.tabOverview : M.tabStaff}
          </Link>
        ))}
      </nav>
      {isLoading ? (
        <LoadingState label={M.loadingFacility} variant="dashboard" />
      ) : isError ? (
        <ErrorState message={M.errorLoadFacility} onRetry={() => refetch()} />
      ) : !assignment ? (
        <EmptyState title={M.noAssignmentTitle} description={M.noAssignmentDescription} />
      ) : activeTab === "staff" ? (
        <FacilityStaffTab
          facilityId={assignment.facilityId}
          facilityName={assignment.facilityName}
        />
      ) : activeTab === "check-in" ? (
        <FacilityBookingsView
          facilityId={assignment.facilityId}
          facilityName={assignment.facilityName}
        />
      ) : (
        <FacilityOverview
          facilityId={assignment.facilityId}
          facilityName={assignment.facilityName}
        />
      )}
    </div>
  );
}
