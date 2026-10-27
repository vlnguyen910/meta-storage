"use client";
import { FacilityTaskStatus } from "@metastorage/contracts";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { OperationalPageHeader } from "@/components/ui/operational";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { FacilityBookingsView } from "@/features/check-in/facility-bookings-view";
import { FacilitySwitcher } from "@/features/facilities/facility-switcher";
import { useFacilityContext } from "@/features/facilities/use-facility-context";
import { TaskPanel } from "@/features/facility-management/task-workspace";
import { FacilityReturnQueue } from "@/features/returns/facility-return-queue";
import { FACILITY_DASHBOARD_MESSAGES as D } from "./dashboard/facility-dashboard.messages";
import { MANAGER_WORKSPACE as M } from "./manager-workspace.messages";

export function ManagerCoordinationScreen() {
  return (
    <Suspense fallback={<LoadingState variant="table" />}>
      <CoordinationContent />
    </Suspense>
  );
}
function CoordinationContent() {
  const scope = useFacilityContext();
  const requested = useSearchParams().get("view");
  const view =
    requested === "tasks" || requested === "reports" || requested === "returns"
      ? requested
      : "bookings";
  if (scope.isLoading) return <LoadingState variant="table" />;
  if (scope.isError)
    return <ErrorState message={D.errorLoadFacility} onRetry={() => scope.refetch()} />;
  if (!scope.currentFacility)
    return <EmptyState title={D.noAssignmentTitle} description={D.noAssignmentDescription} />;
  return (
    <div className="space-y-6">
      {scope.isMultiFacility && (
        <FacilitySwitcher
          activeAssignments={scope.activeAssignments}
          currentFacilityId={scope.currentFacilityId}
          onSwitchFacility={scope.switchFacility}
        />
      )}
      <OperationalPageHeader
        title={M.coordination}
        description={
          view === "bookings"
            ? M.bookingHint(scope.currentFacility.facilityName ?? "")
            : view === "returns"
              ? M.returnsHint
              : view === "reports"
                ? M.reviewsHint
                : M.coordinationHint
        }
      />
      <nav
        aria-label={M.navigation}
        className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xs"
      >
        {[
          { id: "bookings", label: M.booking },
          { id: "tasks", label: M.tasks },
          { id: "reports", label: M.reviews },
          { id: "returns", label: M.returns },
        ].map((item) => (
          <Link
            key={item.id}
            href={`/facility-manager/tasks?view=${item.id}`}
            aria-current={view === item.id ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold ${view === item.id ? "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {view === "bookings" ? (
        <FacilityBookingsView
          facilityId={scope.currentFacilityId}
          facilityName={scope.currentFacility.facilityName}
          headingMode="actions-only"
        />
      ) : view === "returns" ? (
        <FacilityReturnQueue
          actorRole="FACILITY_MANAGER"
          facilityId={scope.currentFacilityId}
          embedded
        />
      ) : (
        <TaskPanel
          key={`${scope.currentFacilityId}:${view}`}
          facilityId={scope.currentFacilityId}
          manager
          status={view === "reports" ? FacilityTaskStatus.AWAITING_APPROVAL : undefined}
        />
      )}
    </div>
  );
}
