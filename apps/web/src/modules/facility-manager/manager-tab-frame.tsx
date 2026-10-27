"use client";
import { Suspense } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { FacilitySwitcher } from "@/features/facilities/facility-switcher";
import { useFacilityContext } from "@/features/facilities/use-facility-context";
import { MANAGER_TABS as M } from "./manager-tabs.messages";
import type { ManagerTabFrameProps } from "./manager-tabs.types";
export function ManagerTabFrame(props: ManagerTabFrameProps) {
  return (
    <Suspense fallback={<LoadingState variant="table" />}>
      <ScopedFrame {...props} />
    </Suspense>
  );
}
function ScopedFrame({ title, description, children }: ManagerTabFrameProps) {
  const scope = useFacilityContext();
  if (scope.isLoading) return <LoadingState variant="table" />;
  if (scope.isError) return <ErrorState message={M.scopeError} onRetry={() => scope.refetch()} />;
  if (!scope.currentFacility)
    return <EmptyState title={M.noFacility} description={M.noFacilityHint} />;
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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      </header>
      <div key={scope.currentFacilityId}>{children(scope.currentFacilityId)}</div>
    </div>
  );
}
