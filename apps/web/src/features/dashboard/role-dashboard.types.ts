import type { UserRole } from "@metastorage/contracts";

export interface RoleDashboardProps {
  role: UserRole;
  facilityId?: string;
}
