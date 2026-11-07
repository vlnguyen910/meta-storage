import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  toApiFacility,
  toApiFacilityAssignment,
} from "../../../src/modules/facilities/facilities.mapper";

describe("facilities mapper", () => {
  it("maps Facility DB entity to ApiFacility contract", () => {
    const now = new Date();
    const facility = {
      id: "b2a3a5f0-61f2-4a0b-8d1a-4d2b3c4d5e6f",
      code: "HN-KHO-01",
      name: "Kho Cầu Giấy",
      address: "123 Cầu Giấy, Hà Nội",
      description: "Kho trung tâm",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const mapped = toApiFacility(facility);

    assert.equal(mapped.id, facility.id);
    assert.equal(mapped.code, facility.code);
    assert.equal(mapped.name, facility.name);
    assert.equal(mapped.address, facility.address);
    assert.equal(mapped.description, facility.description);
    assert.equal(mapped.isActive, true);
    assert.equal(mapped.createdAt, now.toISOString());
    assert.equal(mapped.updatedAt, now.toISOString());
  });

  it("maps FacilityAssignment DB entity to ApiFacilityAssignment contract", () => {
    const now = new Date();
    const assignment = {
      id: "a1a2a3a4-b1b2-c1c2-d1d2-e1e2e3e4e5e6",
      userId: "u1u2u3u4-u1u2-u1u2-u1u2-u1u2u3u4u5u6",
      facilityId: "f1f2f3f4-f1f2-f1f2-f1f2-f1f2f3f4f5f6",
      assignedAt: now,
      endedAt: null,
      isActive: true,
      role: "FACILITY_STAFF" as const,
    };

    const mapped = toApiFacilityAssignment(assignment, {
      userName: "Nguyễn Văn A",
      userEmail: "staff@storex.vn",
      facilityName: "Kho Cầu Giấy",
      facilityCode: "HN-KHO-01",
    });

    assert.equal(mapped.id, assignment.id);
    assert.equal(mapped.userId, assignment.userId);
    assert.equal(mapped.facilityId, assignment.facilityId);
    assert.equal(mapped.role, "FACILITY_STAFF");
    assert.equal(mapped.isActive, true);
    assert.equal(mapped.endedAt, null);
    assert.equal(mapped.userName, "Nguyễn Văn A");
    assert.equal(mapped.facilityName, "Kho Cầu Giấy");
  });
});
