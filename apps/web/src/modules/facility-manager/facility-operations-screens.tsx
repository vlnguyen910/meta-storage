"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { F5 } from "@/features/facility-management/management.messages";
import { TypeCatalogTable } from "@/features/facility-management/management-workspace";
import { StaffDirectoryWorkspace } from "@/features/facility-management/staff-directory";
import { UnitInventoryWorkspace } from "@/features/facility-management/unit-inventory";
import { ManagerCoordinationScreen } from "./manager-coordination-screen";
import { ManagerTabFrame } from "./manager-tab-frame";

export function ManagerInventoryScreen() {
  const [view, setView] = useState<"units" | "types">("units");
  return (
    <div className="space-y-5">
      <fieldset className="flex flex-wrap gap-2" aria-label={F5.inventory}>
        <Button
          variant={view === "units" ? "primary" : "outline"}
          aria-pressed={view === "units"}
          onClick={() => setView("units")}
        >
          {F5.inventory}
        </Button>
        <Button
          variant={view === "types" ? "primary" : "outline"}
          aria-pressed={view === "types"}
          onClick={() => setView("types")}
        >
          {F5.unitTypesAndPrices}
        </Button>
      </fieldset>
      {view === "units" ? (
        <UnitInventoryWorkspace />
      ) : (
        <ManagerTabFrame title={F5.unitTypesAndPrices} description={F5.description}>
          {(facilityId) => <TypeCatalogTable facilityId={facilityId} />}
        </ManagerTabFrame>
      )}
    </div>
  );
}
export function ManagerTasksScreen() {
  return <ManagerCoordinationScreen />;
}
export function ManagerStaffDirectoryScreen() {
  return <StaffDirectoryWorkspace />;
}
