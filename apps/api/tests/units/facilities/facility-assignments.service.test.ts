import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type FacilityStaffMember, UserRole } from "@metastorage/contracts";
import type { FacilityAssignment } from "@metastorage/database";
import type { FacilityScope } from "../../../src/modules/facilities/facilities.access";
import type { FacilitiesRepository } from "../../../src/modules/facilities/facilities.repository";
import type { FacilityAssignmentsRepository } from "../../../src/modules/facilities/facility-assignments.repository";
import { FacilityAssignmentsService } from "../../../src/modules/facilities/facility-assignments.service";

const facilityId = "11111111-1111-1111-1111-111111111111";
const staffId = "88888888-8888-8888-8888-888888888888";
const managerId = "99999999-9999-9999-9999-999999999999";

const mockStaffMember: FacilityStaffMember = {
  id: staffId,
  name: "Tran Quoc Huy",
  email: "staff@metastorage.test",
  phone: "0900000002",
  role: UserRole.FACILITY_STAFF,
  isActive: true,
  assignedTasksCount: 2,
};

const mockAssignment: FacilityAssignment = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  facilityId,
  userId: staffId,
  role: "FACILITY_STAFF",
  isActive: true,
  assignedAt: new Date("2026-01-01T00:00:00Z"),
  endedAt: null,
};

function createService(
  assignmentsRepoOverrides: Partial<FacilityAssignmentsRepository> = {},
  facilitiesRepoOverrides: Partial<FacilitiesRepository> = {},
) {
  const assignmentsRepo = {
    findFacilityStaff: async () => [mockStaffMember],
    findAssignment: async () => mockAssignment,
    deactivateAssignmentWithWorkCheck: async () => ({
      assignment: { ...mockAssignment, isActive: false, endedAt: new Date() },
    }),
    listAssignmentsWithUsers: async () => [
      {
        assignment: mockAssignment,
        userName: mockStaffMember.name,
        userEmail: mockStaffMember.email,
      },
    ],
    listUserAssignmentsWithFacilities: async () => [
      {
        assignment: mockAssignment,
        facilityName: "METASTORAGE Cau Giay",
        facilityCode: "CG-01",
      },
    ],
    ...assignmentsRepoOverrides,
  } as unknown as FacilityAssignmentsRepository;

  const facilitiesRepo = {
    findAccessibleById: async () => ({
      id: facilityId,
      name: "METASTORAGE Cau Giay",
      code: "CG-01",
      address: "123 Cau Giay",
      description: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    ...facilitiesRepoOverrides,
  } as unknown as FacilitiesRepository;

  return new FacilityAssignmentsService(assignmentsRepo, facilitiesRepo);
}

describe("FacilityAssignmentsService - Staff & Task Operations", () => {
  it("retrieves active staff members for a facility including assigned task counts", async () => {
    const service = createService();
    const staff = await service.getFacilityStaff(facilityId);

    assert.equal(staff.length, 1);
    assert.equal(staff[0].id, staffId);
    assert.equal(staff[0].name, "Tran Quoc Huy");
    assert.equal(staff[0].assignedTasksCount, 2);
  });

  it("lists facility assignments for an authorized Facility Manager", async () => {
    const service = createService();
    const managerScope: FacilityScope = {
      kind: "assigned",
      userId: managerId,
      role: "FACILITY_MANAGER",
    };

    const assignments = await service.listFacilityAssignments(facilityId, 10, 0, managerScope);

    assert.equal(assignments.length, 1);
    assert.equal(assignments[0].facilityName, "METASTORAGE Cau Giay");
    assert.equal(assignments[0].userName, "Tran Quoc Huy");
  });

  it("rejects listing assignments when the requester is not a Facility Manager", async () => {
    const service = createService();
    const staffScope: FacilityScope = {
      kind: "assigned",
      userId: staffId,
      role: "FACILITY_STAFF",
    };

    await assert.rejects(() => service.listFacilityAssignments(facilityId, 10, 0, staffScope), {
      name: "ForbiddenError",
    });
  });

  it("throws NotFoundError when revoking a non-existent assignment", async () => {
    const service = createService({
      deactivateAssignmentWithWorkCheck: async () => ({ error: "ASSIGNMENT_NOT_FOUND" }),
    });

    await assert.rejects(
      () => service.revokeAssignment(facilityId, "00000000-0000-0000-0000-000000000000"),
      { name: "NotFoundError" },
    );
  });

  it("lists assigned facilities for an authorized user role", async () => {
    const service = createService();
    const result = await service.listUserAssignments(staffId, "FACILITY_STAFF");

    assert.equal(result.length, 1);
    assert.equal(result[0].facilityCode, "CG-01");
  });

  it("returns empty array for unauthorized roles trying to query user assignments", async () => {
    const service = createService();
    const result = await service.listUserAssignments(staffId, "CUSTOMER");

    assert.deepEqual(result, []);
  });
});
