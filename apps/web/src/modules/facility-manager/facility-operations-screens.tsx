import { StaffDirectoryWorkspace } from "@/features/facility-management/staff-directory";
import { TaskWorkspace } from "@/features/facility-management/task-workspace";
import { UnitInventoryWorkspace } from "@/features/facility-management/unit-inventory";

export function ManagerInventoryScreen() {
  return <UnitInventoryWorkspace />;
}
export function ManagerTasksScreen() {
  return <TaskWorkspace manager />;
}
export function ManagerStaffDirectoryScreen() {
  return <StaffDirectoryWorkspace />;
}
