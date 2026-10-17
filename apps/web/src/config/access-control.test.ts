import { UserRole } from "@metastorage/contracts";
import { describe, expect, it } from "vitest";
import { hasPermission, Permission, rolePermissions } from "./access-control";

describe("role permissions", () => {
  it("allows a customer to reserve but not manage units", () => {
    expect(hasPermission(UserRole.STORAGE_CUSTOMER, Permission.CREATE_RESERVATION)).toBe(true);
    expect(hasPermission(UserRole.STORAGE_CUSTOMER, Permission.MANAGE_STORAGE_UNITS)).toBe(false);
  });

  it("keeps facility staff and manager capabilities separate", () => {
    expect(rolePermissions[UserRole.FACILITY_STAFF]).toContain(Permission.HANDLE_CHECK_IN);
    expect(rolePermissions[UserRole.FACILITY_STAFF]).not.toContain(Permission.MANAGE_STORAGE_UNITS);
    expect(rolePermissions[UserRole.FACILITY_MANAGER]).toContain(Permission.MANAGE_STORAGE_UNITS);
  });
});
