import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toApiUser } from "../../../src/modules/users/users.mapper";

describe("toApiUser", () => {
  it("returns the API contract without persistence-only fields", () => {
    const result = toApiUser({
      id: "3ae5ce7d-42f1-4411-99d3-954d8fda245f",
      name: "Nguyễn Minh Anh",
      email: "customer@storex.vn",
      emailVerified: false,
      image: null,
      phone: null,
      passwordHash: "must-never-leave-the-server",
      role: "CUSTOMER",
      status: "ACTIVE",
      createdAt: new Date("2026-09-22T00:00:00.000Z"),
      updatedAt: new Date("2026-09-22T00:00:00.000Z"),
    });

    assert.deepEqual(result, {
      id: "3ae5ce7d-42f1-4411-99d3-954d8fda245f",
      name: "Nguyễn Minh Anh",
      email: "customer@storex.vn",
      phone: null,
      role: "CUSTOMER",
      status: "ACTIVE",
      createdAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-22T00:00:00.000Z",
    });
    assert.equal("passwordHash" in result, false);
    assert.equal("emailVerified" in result, false);
  });
});
