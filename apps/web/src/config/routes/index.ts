import { UserRole } from "@metastorage/contracts";
import { businessOperationsRoutes } from "./business-operations.routes";
import { customerRoutes } from "./customer.routes";
import { facilityManagerRoutes } from "./facility-manager.routes";
import { facilityStaffRoutes } from "./facility-staff.routes";
import { publicRoutes } from "./public.routes";
import { systemAdministratorRoutes } from "./system-administrator.routes";

export {
  businessOperationsRoutes,
  customerRoutes,
  facilityManagerRoutes,
  facilityStaffRoutes,
  publicRoutes,
  systemAdministratorRoutes,
};

export const routes = {
  ...publicRoutes,
  customer: customerRoutes,
  staff: facilityStaffRoutes,
  facilityManager: facilityManagerRoutes,
  operations: businessOperationsRoutes,
  systemAdmin: systemAdministratorRoutes,
} as const;

export const roleHome: Record<UserRole, string> = {
  [UserRole.STORAGE_CUSTOMER]: customerRoutes.dashboard,
  [UserRole.FACILITY_STAFF]: facilityStaffRoutes.dashboard,
  [UserRole.FACILITY_MANAGER]: facilityManagerRoutes.dashboard,
  [UserRole.BUSINESS_OPERATIONS_MANAGER]: businessOperationsRoutes.dashboard,
  [UserRole.SYSTEM_ADMINISTRATOR]: systemAdministratorRoutes.dashboard,
};

export function safeReturnTo(value: string | null, fallback: string): string {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  return value;
}
