import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { StorageUnit } from "@metastorage/database";
import type { FacilityAssignmentsRepository } from "../../../src/modules/facilities/facility-assignments.repository";
import type { StorageUnitsRepository } from "../../../src/modules/storage-units/storage-units.repository";
import { StorageUnitsService } from "../../../src/modules/storage-units/storage-units.service";

const facilityId = "11111111-1111-1111-1111-111111111111";
const otherFacilityId = "22222222-2222-2222-2222-222222222222";
const managerId = "99999999-9999-9999-9999-999999999999";
const staffId = "88888888-8888-8888-8888-888888888888";
const unitId = "33333333-3333-3333-3333-333333333333";

const mockUnit: StorageUnit = {
  id: unitId,
  facilityId,
  unitTypeId: "44444444-4444-4444-4444-444444444444",
  code: "U-101",
  floor: "1",
  locationDescription: "Near main entrance",
  status: "AVAILABLE",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function createService(
  unitRepoOverrides: Partial<StorageUnitsRepository> = {},
  assignmentsRepoOverrides: Partial<FacilityAssignmentsRepository> = {},
) {
  const unitRepo = {
    findById: async (id: string) => (id === unitId ? mockUnit : undefined),
    transitionStatus: async (id: string, targetStatus: "AVAILABLE" | "MAINTENANCE") => ({
      success: true as const,
      unit: { ...mockUnit, id, status: targetStatus, updatedAt: new Date() },
    }),
    getAvailableCapacity: async () => 5,
    ...unitRepoOverrides,
  } as unknown as StorageUnitsRepository;

  const assignmentsRepo = {
    findActiveAssignment: async (facId: string, uId: string, role: string) => {
      if (facId === facilityId && uId === managerId && role === "FACILITY_MANAGER") {
        return {
          id: "assign-1",
          facilityId,
          userId: managerId,
          role: "FACILITY_MANAGER",
          isActive: true,
          assignedAt: new Date(),
          endedAt: null,
        };
      }
      return undefined;
    },
    ...assignmentsRepoOverrides,
  } as unknown as FacilityAssignmentsRepository;

  return new StorageUnitsService(unitRepo, assignmentsRepo);
}

describe("StorageUnitsService - Maintenance & Permission Operations (F4)", () => {
  it("rejects transition when user is FACILITY_STAFF (Staff has no permission)", async () => {
    const service = createService();
    await assert.rejects(
      () =>
        service.transitionStatus(unitId, "MAINTENANCE", "Sửa khóa", {
          id: staffId,
          role: "FACILITY_STAFF",
        }),
      { name: "ForbiddenError" },
    );
  });

  it("rejects transition when Facility Manager is assigned to a different facility", async () => {
    const otherUnit: StorageUnit = { ...mockUnit, facilityId: otherFacilityId };
    const service = createService({
      findById: async () => otherUnit,
    });

    await assert.rejects(
      () =>
        service.transitionStatus(unitId, "MAINTENANCE", "Bảo dưỡng", {
          id: managerId,
          role: "FACILITY_MANAGER",
        }),
      { name: "ForbiddenError" },
    );
  });

  it("throws NotFoundError when unit does not exist", async () => {
    const service = createService({
      findById: async () => undefined,
    });

    await assert.rejects(
      () =>
        service.transitionStatus("non-existent-id", "MAINTENANCE", "Bảo dưỡng", {
          id: managerId,
          role: "FACILITY_MANAGER",
        }),
      { name: "NotFoundError" },
    );
  });

});
