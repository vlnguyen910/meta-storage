import { AdminWorkspace } from "@/features/administration/admin-workspace";

export function SystemAdministratorAssignmentsScreen() {
  return <AdminWorkspace section="assignments" />;
}

export function SystemAdministratorLoginHistoryScreen() {
  return <AdminWorkspace section="login-history" />;
}

export function SystemAdministratorActivityLogsScreen() {
  return <AdminWorkspace section="activity-logs" />;
}
