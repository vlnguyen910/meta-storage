"use client";
import { Suspense } from "react";
import { OperationalPageHeader } from "@/components/ui/operational";
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
    <div className="space-y-6">
      {scope.isMultiFacility && (
        <FacilitySwitcher
          activeAssignments={scope.activeAssignments}
          currentFacilityId={scope.currentFacilityId}
          onSwitchFacility={scope.switchFacility}
        />
      )}
      <OperationalPageHeader title={title} description={description} />
      <div key={scope.currentFacilityId}>{children(scope.currentFacilityId)}</div>
    </div>
  );
}
