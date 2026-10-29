export const UserRole = {
  STORAGE_CUSTOMER: "CUSTOMER",
  FACILITY_STAFF: "FACILITY_STAFF",
  FACILITY_MANAGER: "FACILITY_MANAGER",
  BUSINESS_OPERATIONS_MANAGER: "BUSINESS_OPERATION_MANAGER",
  SYSTEM_ADMINISTRATOR: "SYSTEM_ADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export type Role = UserRole;

export const ROLES = Object.values(UserRole);
export const USER_STATUS = Object.values(UserStatus);
