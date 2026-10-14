import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCheckInSlotEnd } from "../../../src/modules/check-ins/check-in-slot";
import { evaluateCheckInEligibility } from "../../../src/modules/check-ins/check-ins.policy";

describe("two-hour check-in slot", () => {
  it("uses the selected appointment rather than payment time", () => {
    const start = new Date("2026-12-15T09:00:00+07:00");
    const end = getCheckInSlotEnd(start);
    assert.equal(end.toISOString(), "2026-12-15T04:00:00.000Z");
    assert.equal(start.toISOString(), "2026-12-15T02:00:00.000Z");
  });
  it("handles appointments crossing midnight", () => {
    assert.equal(
      getCheckInSlotEnd(new Date("2026-10-05T23:30:00+07:00")).toISOString(),
      "2026-10-05T18:30:00.000Z",
    );
  });
  it("allows a paid assigned booking until the final slot ends and rejects the cutoff itself", () => {
    const start = new Date("2026-12-15T02:00:00.000Z");
    const record = {
      bookingStatus: "CONFIRMED",
      payment: { status: "SUCCEEDED" },
      hasAssignedUnit: true,
      checkInSlotStart: start,
      checkInDayEnd: new Date("2026-12-15T11:00:00.000Z"),
      verification: null,
    };
    const during = evaluateCheckInEligibility(record, new Date("2026-12-15T03:00:00.000Z"));
    assert.equal(during.canProceed, true);
    assert.equal(during.graceEndsAt?.toISOString(), "2026-12-15T11:00:00.000Z");
    assert.equal(
      evaluateCheckInEligibility(record, new Date("2026-12-15T09:00:00.000Z")).canProceed,
      true,
    );
    assert.deepEqual(
      evaluateCheckInEligibility(record, new Date("2026-12-15T11:00:00.000Z")).reasons,
      ["DEADLINE_PASSED"],
    );
  });
});
