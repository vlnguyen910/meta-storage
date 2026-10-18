"use client";

import { UserRole } from "@metastorage/contracts";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { FacilityBookingsView } from "@/features/check-in/facility-bookings-view";
import { RoleDashboard } from "@/features/dashboard/role-dashboard";
import { FacilitySwitcher } from "@/features/facilities/facility-switcher";
import { useFacilityContext } from "@/features/facilities/use-facility-context";
import { FLOW } from "@/features/facility-flow/flow.messages";
import { FlowHeading } from "@/features/facility-flow/flow-ui";
import { STAFF_DASHBOARD_MESSAGES as M } from "./staff-dashboard.messages";

export function FacilityStaffDashboardScreen() {
  return (
    <Suspense fallback={<LoadingState label={FLOW.loading} />}>
      <StaffDashboardContent />
    </Suspense>
  );
}

function StaffDashboardContent() {
  const view = useSearchParams().get("view");
  const activeTab = view === "overview" ? "overview" : "tasks";
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
      <nav className="flex flex-wrap gap-2" aria-label={M.navAriaLabel}>
        <Link
          href="?view=tasks"
          aria-current={activeTab === "tasks" ? "page" : undefined}
          className={`rounded px-4 py-2 text-sm font-semibold ${
            activeTab === "tasks" ? "bg-primary text-white" : "bg-white text-muted"
          }`}
        >
          {M.tabTasks}
        </Link>
        <Link
          href="?view=overview"
          aria-current={activeTab === "overview" ? "page" : undefined}
          className={`rounded px-4 py-2 text-sm font-semibold ${
            activeTab === "overview" ? "bg-primary text-white" : "bg-white text-muted"
          }`}
        >
          {M.tabOverview}
        </Link>
      </nav>

      {activeTab === "overview" ? (
        <>
          <FlowHeading title={FLOW.overview} />
          <RoleDashboard role={UserRole.FACILITY_STAFF} facilityId={currentFacilityId} />
        </>
      ) : isLoading ? (
        <LoadingState label={FLOW.loading} />
      ) : isError ? (
        <ErrorState message={FLOW.error} onRetry={() => refetch()} />
      ) : !assignment ? (
        <EmptyState title={FLOW.noFacility} description={FLOW.noBookingsHint} />
      ) : (
        <FacilityBookingsView
          facilityId={assignment.facilityId}
          facilityName={assignment.facilityName}
        />
      )}
    </div>
  );
}
