"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { FacilityBookingsView } from "@/features/check-in/facility-bookings-view";
import { FacilitySwitcher } from "@/features/facilities/facility-switcher";
import { useFacilityContext } from "@/features/facilities/use-facility-context";
import { TaskPanel } from "@/features/facility-management/task-workspace";
import { cn } from "@/lib/utils";
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
  const view = requested === "tasks" ? requested : "bookings";
  if (scope.isLoading) return <LoadingState variant="table" />;
  if (scope.isError)
    return <ErrorState message={D.errorLoadFacility} onRetry={() => scope.refetch()} />;
  if (!scope.currentFacility)
    return <EmptyState title={D.noAssignmentTitle} description={D.noAssignmentDescription} />;
  return (
    <div className="space-y-4 pt-1">
      {scope.isMultiFacility && (
        <FacilitySwitcher
          activeAssignments={scope.activeAssignments}
          currentFacilityId={scope.currentFacilityId}
          onSwitchFacility={scope.switchFacility}
        />
      )}
      <nav aria-label={M.navigation} className="flex flex-wrap items-center gap-2">
        {[
          { id: "bookings", label: M.booking },
          { id: "tasks", label: M.tasks },
        ].map((item) => {
          const active = view === item.id;
          return (
            <Link
              key={item.id}
              href={`/facility-manager/tasks?view=${item.id}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-lg px-4 text-xs font-bold transition-all shadow-2xs cursor-pointer",
                active
                  ? "bg-primary text-white hover:bg-primary hover:text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <header className={view === "bookings" ? "sr-only" : undefined}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {view === "bookings" ? M.booking : M.tasks}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {view === "bookings"
            ? M.bookingHint(scope.currentFacility.facilityName ?? "cơ sở được phân công")
            : M.coordinationHint}
        </p>
      </header>
      {view === "bookings" ? (
        <FacilityBookingsView
          facilityId={scope.currentFacilityId}
          facilityName={scope.currentFacility.facilityName}
          headingMode="actions-only"
        />
      ) : (
        <TaskPanel
          key={`${scope.currentFacilityId}:${view}`}
          facilityId={scope.currentFacilityId}
          manager
        />
      )}
    </div>
  );
}
