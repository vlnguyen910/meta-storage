import { describe, expect, test } from "bun:test";
import {
  assertAssignedStaff,
  assertFlowReadAccess,
} from "../../../src/modules/check-ins/check-in-access";

describe("Flow 2 responsibility boundaries", () => {
  test("only the assigned Staff can execute a task", () => {
    expect(() =>
      assertAssignedStaff({ id: "staff", role: "FACILITY_STAFF" }, "staff"),
    ).not.toThrow();
    for (const actor of [
      { id: "staff", role: "FACILITY_MANAGER" },
      { id: "other", role: "FACILITY_STAFF" },
      { id: "admin", role: "SYSTEM_ADMIN" },
    ]) {
      expect(() => assertAssignedStaff(actor, "staff")).toThrow();
    }
    expect(() => assertAssignedStaff({ id: "staff", role: "FACILITY_STAFF" }, null)).toThrow();
  });
  test("FM can monitor while another Staff cannot open the task", () => {
    expect(() =>
      assertFlowReadAccess({ id: "manager", role: "FACILITY_MANAGER" }, "staff"),
    ).not.toThrow();
    expect(() => assertFlowReadAccess({ id: "other", role: "FACILITY_STAFF" }, "staff")).toThrow();
  });
});
