import { AdminWorkspace } from "@/features/administration/admin-workspace";
import { FacilityManagementWorkspace } from "@/features/facility-management/management-workspace";

export function SystemAdministratorAssignmentsScreen() {
  return <FacilityManagementWorkspace membershipsOnly />;
}

export function SystemAdministratorLoginHistoryScreen() {
  return <AdminWorkspace section="login-history" />;
}

export function SystemAdministratorActivityLogsScreen() {
  return <AdminWorkspace section="activity-logs" />;
}
