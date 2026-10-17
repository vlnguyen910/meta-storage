import { UserRole } from "@metastorage/contracts";
import { businessOperationsNavigation } from "./business-operations.navigation";
import { customerNavigation } from "./customer.navigation";
import { facilityManagerNavigation } from "./facility-manager.navigation";
import { facilityStaffNavigation } from "./facility-staff.navigation";
import { systemAdministratorNavigation } from "./system-administrator.navigation";
import type { NavigationItem } from "./types";

export const navigationByRole: Record<UserRole, NavigationItem[]> = {
  [UserRole.STORAGE_CUSTOMER]: customerNavigation,
  [UserRole.FACILITY_STAFF]: facilityStaffNavigation,
  [UserRole.FACILITY_MANAGER]: facilityManagerNavigation,
  [UserRole.BUSINESS_OPERATIONS_MANAGER]: businessOperationsNavigation,
  [UserRole.SYSTEM_ADMINISTRATOR]: systemAdministratorNavigation,
};
