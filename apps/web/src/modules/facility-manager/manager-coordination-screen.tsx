"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { AppointmentWorkspace } from "@/features/appointments/appointment-workspace";
import { FacilitySwitcher } from "@/features/facilities/facility-switcher";
import { useFacilityContext } from "@/features/facilities/use-facility-context";
import { TaskPanel } from "@/features/facility-management/task-workspace";
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
  const view = requested === "tasks" ? requested : "appointments";
  if (scope.isLoading) return <LoadingState variant="table" />;
  if (scope.isError)
    return <ErrorState message={D.errorLoadFacility} onRetry={() => scope.refetch()} />;
  if (!scope.currentFacility)
    return <EmptyState title={D.noAssignmentTitle} description={D.noAssignmentDescription} />;
  return (
    <div className="space-y-6 pt-5">
      {scope.isMultiFacility && (
        <FacilitySwitcher
          activeAssignments={scope.activeAssignments}
          currentFacilityId={scope.currentFacilityId}
          onSwitchFacility={scope.switchFacility}
        />
      )}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {view === "appointments" ? M.booking : M.tasks}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {view === "appointments"
            ? M.bookingHint(scope.currentFacility.facilityName ?? "cơ sở được phân công")
            : M.coordinationHint}
        </p>
      </header>
      <nav
        aria-label={M.navigation}
        className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2"
      >
        {[
          { id: "appointments", label: M.booking },
          { id: "tasks", label: M.tasks },
        ].map((item) => (
          <Link
            key={item.id}
            href={`/facility-manager/tasks?view=${item.id}`}
            aria-current={view === item.id ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold ${view === item.id ? "bg-emerald-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {view === "appointments" ? (
        <AppointmentWorkspace facilityId={scope.currentFacilityId} manager />
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
