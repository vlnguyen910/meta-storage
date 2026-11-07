import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NewFacilityAssignment } from "@storex/database";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../../src/common/errors/app-error";
import type { FacilitiesRepository } from "../../../src/modules/facilities/facilities.repository";
import { FacilitiesService } from "../../../src/modules/facilities/facilities.service";
import type { UsersRepository } from "../../../src/modules/users/users.repository";

describe("facilities service", () => {
  it("throws ConflictError when creating a facility with existing code", async () => {
    const mockFacilitiesRepo = {
      findByCode: async (code: string) => ({
        id: "1",
        code,
        name: "Test",
        address: "Address",
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as unknown as FacilitiesRepository;

    const mockUsersRepo = {} as UsersRepository;
    const service = new FacilitiesService(mockFacilitiesRepo, mockUsersRepo);

    await assert.rejects(
      () =>
        service.createFacility({
          code: "EXISTING",
          name: "Test Facility",
          address: "123 Street",
        }),
      ConflictError,
    );
  });

  it("throws NotFoundError when facility does not exist", async () => {
    const mockFacilitiesRepo = {
      findById: async () => undefined,
    } as unknown as FacilitiesRepository;

    const mockUsersRepo = {} as UsersRepository;
    const service = new FacilitiesService(mockFacilitiesRepo, mockUsersRepo);

    await assert.rejects(
      () => service.getFacilityById("00000000-0000-0000-0000-000000000000"),
      NotFoundError,
    );
  });

  it("throws BadRequestError when assigning an inactive user to facility", async () => {
    const mockFacilitiesRepo = {
      findById: async () => ({
        id: "f1",
        code: "F1",
        name: "Facility 1",
        address: "Address",
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as unknown as FacilitiesRepository;

    const mockUsersRepo = {
      findById: async () => ({
        id: "u1",
        name: "User Inactive",
        email: "inactive@storex.vn",
        status: "INACTIVE" as const,
        role: "FACILITY_STAFF" as const,
        emailVerified: true,
        image: null,
        phone: null,
        passwordHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as unknown as UsersRepository;

    const service = new FacilitiesService(mockFacilitiesRepo, mockUsersRepo);

    await assert.rejects(
      () =>
        service.assignUserToFacility("f1", {
          userId: "u1",
          role: "FACILITY_STAFF",
        }),
      BadRequestError,
    );
  });

  it("successfully assigns active user to facility", async () => {
    const now = new Date();
    const mockFacilitiesRepo = {
      findById: async () => ({
        id: "f1",
        code: "F1",
        name: "Facility 1",
        address: "Address",
        description: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }),
      upsertAssignment: async (data: NewFacilityAssignment) => ({
        id: "a1",
        facilityId: data.facilityId,
        userId: data.userId,
        role: data.role,
        isActive: true,
        assignedAt: now,
        endedAt: null,
      }),
    } as unknown as FacilitiesRepository;

    const mockUsersRepo = {
      findById: async () => ({
        id: "u1",
        name: "User Active",
        email: "active@storex.vn",
        status: "ACTIVE" as const,
        role: "FACILITY_STAFF" as const,
        emailVerified: true,
        image: null,
        phone: null,
        passwordHash: null,
        createdAt: now,
        updatedAt: now,
      }),
    } as unknown as UsersRepository;

    const service = new FacilitiesService(mockFacilitiesRepo, mockUsersRepo);

    const result = await service.assignUserToFacility("f1", {
      userId: "u1",
      role: "FACILITY_STAFF",
    });

    assert.equal(result.facilityId, "f1");
    assert.equal(result.userId, "u1");
    assert.equal(result.role, "FACILITY_STAFF");
    assert.equal(result.userName, "User Active");
    assert.equal(result.facilityCode, "F1");
  });
});
