import { StaffDirectoryWorkspace } from "@/features/facility-management/staff-directory";
import { UnitInventoryWorkspace } from "@/features/facility-management/unit-inventory";
import { ManagerCoordinationScreen } from "./manager-coordination-screen";

export function ManagerInventoryScreen() {
  return <UnitInventoryWorkspace />;
}
export function ManagerTasksScreen() {
  return <ManagerCoordinationScreen />;
}
export function ManagerStaffDirectoryScreen() {
  return <StaffDirectoryWorkspace />;
}
