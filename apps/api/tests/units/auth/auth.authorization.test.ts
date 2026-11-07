import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ForbiddenError } from "../../../src/common/errors/app-error";
import { assertActiveUser, assertUserHasRole } from "../../../src/modules/auth/auth.authorization";

const activeCustomer = {
  role: "CUSTOMER",
  status: "ACTIVE",
};

describe("authentication authorization policy", () => {
  it("accepts an active user with an allowed role", () => {
    assert.doesNotThrow(() => {
      assertActiveUser(activeCustomer);
      assertUserHasRole(activeCustomer, ["CUSTOMER", "SYSTEM_ADMIN"]);
    });
  });

  it("rejects inactive users even when they have a valid session", () => {
    assert.throws(
      () => assertActiveUser({ ...activeCustomer, status: "INACTIVE" }),
      ForbiddenError,
    );
  });

  it("rejects a user whose role is not permitted", () => {
    assert.throws(() => assertUserHasRole(activeCustomer, ["SYSTEM_ADMIN"]), ForbiddenError);
  });

  it("rejects a session missing a recognized role", () => {
    assert.throws(
      () => assertUserHasRole({ role: null, status: "ACTIVE" }, ["SYSTEM_ADMIN"]),
      ForbiddenError,
    );
  });
});
