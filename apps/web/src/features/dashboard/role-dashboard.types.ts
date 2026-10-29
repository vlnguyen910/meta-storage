import type { UserRole } from "@metastorage/database/schema/user-enums";

export interface RoleDashboardProps {
  role: UserRole;
  facilityId?: string;
}
