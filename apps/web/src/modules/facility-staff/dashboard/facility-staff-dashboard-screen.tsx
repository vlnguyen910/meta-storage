import { UserRole } from "@metastorage/contracts";
import { RoleDashboard } from "@/features/dashboard/role-dashboard";

export function FacilityStaffDashboardScreen() {
  return <RoleDashboard role={UserRole.FACILITY_STAFF} />;
}
