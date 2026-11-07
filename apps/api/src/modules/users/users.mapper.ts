import { type ApiUser, UserRole } from "@storex/contracts";
import type { Role, User } from "@storex/database";

const apiRoleByDatabaseRole: Record<Role, UserRole> = {
  CUSTOMER: UserRole.STORAGE_CUSTOMER,
  FACILITY_STAFF: UserRole.FACILITY_STAFF,
  FACILITY_MANAGER: UserRole.FACILITY_MANAGER,
  BUSINESS_OPERATION_MANAGER: UserRole.BUSINESS_OPERATIONS_MANAGER,
  SYSTEM_ADMIN: UserRole.SYSTEM_ADMINISTRATOR,
};

export function toApiUser(user: User): ApiUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role ? apiRoleByDatabaseRole[user.role] : UserRole.STORAGE_CUSTOMER,
    status: user.status ?? "ACTIVE",
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
