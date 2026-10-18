import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type FacilityStaffMember, UserRole } from "@metastorage/contracts";
import type { FacilityAssignment, User } from "@metastorage/database";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../../src/common/errors/app-error";
import type { FacilityScope } from "../../../src/modules/facilities/facilities.access";
import { FACILITY_MESSAGES } from "../../../src/modules/facilities/facilities.messages";
import type { FacilitiesRepository } from "../../../src/modules/facilities/facilities.repository";
import type { FacilityAssignmentsRepository } from "../../../src/modules/facilities/facility-assignments.repository";
import { FacilityAssignmentsService } from "../../../src/modules/facilities/facility-assignments.service";
import type { UsersRepository } from "../../../src/modules/users/users.repository";

const facilityId = "11111111-1111-1111-1111-111111111111";
const otherFacilityId = "22222222-2222-2222-2222-222222222222";
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

const mockFacility = {
  id: facilityId,
  name: "METASTORAGE Cau Giay",
  code: "CG-01",
  address: "123 Cau Giay",
  description: null,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const mockUser: User = {
  id: staffId,
  name: "Tran Quoc Huy",
  email: "staff@metastorage.test",
  phone: "0900000002",
  role: "FACILITY_STAFF",
  status: "ACTIVE",
  emailVerified: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function createService(
  assignmentsRepoOverrides: Partial<FacilityAssignmentsRepository> = {},
  facilitiesRepoOverrides: Partial<FacilitiesRepository> = {},
  usersRepoOverrides: Partial<UsersRepository> = {},
) {
  const assignmentsRepo = {
    findFacilityStaff: async () => [mockStaffMember],
    findAssignment: async () => mockAssignment,
    findUserActiveAssignment: async () => undefined,
    hasActiveConfirmedTasks: async () => false,
    upsertAssignment: async (data: Record<string, unknown>) => ({
      ...mockAssignment,
      ...data,
    }),
    deactivateAssignment: async () => ({ ...mockAssignment, isActive: false, endedAt: new Date() }),
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
    findById: async () => mockFacility,
    findAccessibleById: async () => mockFacility,
    ...facilitiesRepoOverrides,
  } as unknown as FacilitiesRepository;

  const usersRepo = {
    findById: async () => mockUser,
    ...usersRepoOverrides,
  } as unknown as UsersRepository;

  return new FacilityAssignmentsService(assignmentsRepo, facilitiesRepo, usersRepo);
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
      findAssignment: async () => undefined,
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

describe("FacilityAssignmentsService - SA Assignment Management", () => {
  it("successfully assigns user to facility when valid", async () => {
    const service = createService();
    const result = await service.assignUserToFacility(facilityId, staffId, "FACILITY_STAFF");

    assert.equal(result.facilityId, facilityId);
    assert.equal(result.userId, staffId);
    assert.equal(result.role, "FACILITY_STAFF");
    assert.equal(result.isActive, true);
    assert.equal(result.facilityName, "METASTORAGE Cau Giay");
    assert.equal(result.facilityCode, "CG-01");
    assert.equal(result.userName, "Tran Quoc Huy");
    assert.equal(result.userEmail, "staff@metastorage.test");
  });

  it("rejects assignment if target facility does not exist", async () => {
    const service = createService({}, { findById: async () => undefined });
    await assert.rejects(
      () => service.assignUserToFacility(facilityId, staffId, "FACILITY_STAFF"),
      (err: Error) => {
        assert(err instanceof NotFoundError);
        assert.equal(err.message, FACILITY_MESSAGES.facilityNotFound(facilityId));
        return true;
      },
    );
  });

  it("rejects assignment if target facility is inactive", async () => {
    const service = createService(
      {},
      { findById: async () => ({ ...mockFacility, isActive: false }) },
    );
    await assert.rejects(
      () => service.assignUserToFacility(facilityId, staffId, "FACILITY_STAFF"),
      (err: Error) => {
        assert(err instanceof BadRequestError);
        assert.equal(err.message, FACILITY_MESSAGES.facilityInactiveAssignment);
        return true;
      },
    );
  });

  it("rejects assignment if user does not exist", async () => {
    const service = createService({}, {}, { findById: async () => undefined });
    await assert.rejects(
      () => service.assignUserToFacility(facilityId, staffId, "FACILITY_STAFF"),
      (err: Error) => {
        assert(err instanceof NotFoundError);
        assert.equal(err.message, FACILITY_MESSAGES.userNotFound(staffId));
        return true;
      },
    );
  });

  it("rejects assignment if user status is not ACTIVE", async () => {
    const service = createService(
      {},
      {},
      { findById: async () => ({ ...mockUser, status: "SUSPENDED" }) },
    );
    await assert.rejects(
      () => service.assignUserToFacility(facilityId, staffId, "FACILITY_STAFF"),
      (err: Error) => {
        assert(err instanceof BadRequestError);
        assert.equal(err.message, FACILITY_MESSAGES.inactiveUserAssignment);
        return true;
      },
    );
  });

  it("rejects assignment if user role mismatches assignment role", async () => {
    const service = createService();
    await assert.rejects(
      () => service.assignUserToFacility(facilityId, staffId, "FACILITY_MANAGER"),
      (err: Error) => {
        assert(err instanceof BadRequestError);
        assert.equal(err.message, FACILITY_MESSAGES.assignmentRoleMismatch);
        return true;
      },
    );
  });

  it("rejects assignment if user has active assignment at another facility (Single active facility rule - F1)", async () => {
    const service = createService({
      findUserActiveAssignment: async () => ({
        ...mockAssignment,
        facilityId: otherFacilityId,
      }),
    });
    await assert.rejects(
      () => service.assignUserToFacility(facilityId, staffId, "FACILITY_STAFF"),
      (err: Error) => {
        assert(err instanceof ConflictError);
        assert.equal(err.message, FACILITY_MESSAGES.userAlreadyAssigned);
        return true;
      },
    );
  });

  it("allows reassignment to the same facility", async () => {
    const service = createService({
      findUserActiveAssignment: async () => ({
        ...mockAssignment,
        facilityId,
      }),
    });
    const result = await service.assignUserToFacility(facilityId, staffId, "FACILITY_STAFF");
    assert.equal(result.facilityId, facilityId);
    assert.equal(result.userId, staffId);
  });

  it("successfully revokes assignment when user has no active tasks", async () => {
    const service = createService({
      findAssignment: async () => mockAssignment,
      hasActiveConfirmedTasks: async () => false,
      deactivateAssignment: async () => ({
        ...mockAssignment,
        isActive: false,
        endedAt: new Date("2026-06-01T00:00:00Z"),
      }),
    });
    const result = await service.revokeAssignment(facilityId, staffId);
    assert.equal(result.isActive, false);
    assert.equal(result.userId, staffId);
    assert.equal(result.facilityId, facilityId);
    assert.equal(typeof result.endedAt, "string");
  });

  it("rejects revoking assignment if user has active confirmed tasks", async () => {
    const service = createService({
      findAssignment: async () => mockAssignment,
      hasActiveConfirmedTasks: async () => true,
    });
    await assert.rejects(
      () => service.revokeAssignment(facilityId, staffId),
      (err: Error) => {
        assert(err instanceof ConflictError);
        assert.equal(err.message, FACILITY_MESSAGES.staffHasPendingTasks);
        return true;
      },
    );
  });
});
