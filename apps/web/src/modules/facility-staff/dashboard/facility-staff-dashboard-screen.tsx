"use client";
import { UserRole } from "@metastorage/contracts";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { FacilityBookingsView } from "@/features/check-in/facility-bookings-view";
import { useMyFacilityAssignments } from "@/features/check-in/hooks";
import { RoleDashboard } from "@/features/dashboard/role-dashboard";
import { FLOW } from "@/features/facility-flow/flow.messages";
import { FlowHeading } from "@/features/facility-flow/flow-ui";
export function FacilityStaffDashboardScreen() {
  return (
    <Suspense fallback={<LoadingState label={FLOW.loading} />}>
      <StaffDashboardContent />
    </Suspense>
  );
}
function StaffDashboardContent() {
  const overview = useSearchParams().get("view") === "overview";
  const assignments = useMyFacilityAssignments();
  const facility = assignments.data?.find((a) => a.isActive) ?? assignments.data?.[0];
  if (overview)
    return (
      <>
        <FlowHeading title={FLOW.overview} />
        <RoleDashboard role={UserRole.FACILITY_STAFF} />
      </>
    );
  if (assignments.isLoading) return <LoadingState label={FLOW.loading} />;
  if (assignments.isError)
    return <ErrorState message={FLOW.error} onRetry={() => assignments.refetch()} />;
  if (!facility) return <EmptyState title={FLOW.noFacility} description={FLOW.noBookingsHint} />;
  return (
    <FacilityBookingsView facilityId={facility.facilityId} facilityName={facility.facilityName} />
  );
}
