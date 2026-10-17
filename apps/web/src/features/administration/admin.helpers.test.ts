import { UserRole } from "@metastorage/contracts";
import { describe, expect, it } from "vitest";
import { applyAdminChange, csvCell, isFacilityRole, matchesDate } from "./admin.helpers";
import { adminMockData } from "./admin.mock";

describe("Admin local demonstration", () => {
  it("limits facility assignment to FS and FM", () => {
    expect(isFacilityRole(UserRole.FACILITY_STAFF)).toBe(true);
    expect(isFacilityRole(UserRole.FACILITY_MANAGER)).toBe(true);
    expect(isFacilityRole(UserRole.SYSTEM_ADMINISTRATOR)).toBe(false);
    expect(isFacilityRole(UserRole.BUSINESS_OPERATIONS_MANAGER)).toBe(false);
    expect(isFacilityRole(UserRole.STORAGE_CUSTOMER)).toBe(false);
  });
  it("updates a mock account and records safe before/after snapshots without mutating fixtures", () => {
    const result = applyAdminChange(adminMockData, {
      userId: "demo-manager",
      action: "STATUS_CHANGED",
      patch: { status: "INACTIVE" },
      reason: "Demo",
      actor: "Demo admin",
    });
    expect(result.users.find((user) => user.id === "demo-manager")?.status).toBe("INACTIVE");
    expect(adminMockData.users.find((user) => user.id === "demo-manager")?.status).toBe("ACTIVE");
    expect(result.audits[0]?.before.status).toBe("ACTIVE");
    expect(result.audits[0]?.after.status).toBe("INACTIVE");
    expect(Object.keys(result.audits[0]?.after ?? {}).sort()).toEqual([
      "facilityIds",
      "role",
      "status",
    ]);
  });
  it("filters dates in Vietnam time rather than UTC", () => {
    expect(matchesDate("2026-10-07T18:00:00Z", "2026-10-08")).toBe(true);
    expect(matchesDate("2026-10-07T18:00:00Z", "2026-10-07")).toBe(false);
  });
  it("escapes CSV quotes and spreadsheet formulas", () => {
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell("=1+1")).toBe('"\'=1+1"');
  });
});
