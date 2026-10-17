import { UserRole } from "@metastorage/contracts";
import { businessOperationsPermissions } from "./business-operations.permissions";
import { customerPermissions } from "./customer.permissions";
import { facilityManagerPermissions } from "./facility-manager.permissions";
import { facilityStaffPermissions } from "./facility-staff.permissions";
import type { Permission } from "./permissions";
import { systemAdministratorPermissions } from "./system-administrator.permissions";

export const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.STORAGE_CUSTOMER]: [...customerPermissions],
  [UserRole.FACILITY_STAFF]: [...facilityStaffPermissions],
  [UserRole.FACILITY_MANAGER]: [...facilityManagerPermissions],
  [UserRole.BUSINESS_OPERATIONS_MANAGER]: [...businessOperationsPermissions],
  [UserRole.SYSTEM_ADMINISTRATOR]: [...systemAdministratorPermissions],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export { Permission } from "./permissions";
