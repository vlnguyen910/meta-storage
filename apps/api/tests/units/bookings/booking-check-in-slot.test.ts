import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateCheckInEligibility } from "../../../src/modules/bookings/booking-check-in.policy";
import { getCheckInSlotEnd } from "../../../src/modules/bookings/booking-check-in-slot";

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
  it("allows early check-in only when explicitly enabled, retaining all other blockers", () => {
    const record = {
      bookingStatus: "CONFIRMED",
      payment: { status: "SUCCEEDED" },
      hasAssignedUnit: true,
      checkInSlotStart: new Date("2026-12-16T02:00:00Z"),
      checkInDayEnd: new Date("2026-12-16T11:00:00Z"),
    };
    const now = new Date("2026-12-15T03:00:00Z");
    assert.deepEqual(evaluateCheckInEligibility(record, now).reasons, ["TOO_EARLY"]);
    assert.equal(evaluateCheckInEligibility(record, now, true).canProceed, true);
    assert.deepEqual(
      evaluateCheckInEligibility(
        { ...record, payment: { status: "PENDING" }, hasAssignedUnit: false },
        now,
        true,
      ).reasons,
      ["PAYMENT_NOT_SUCCEEDED", "UNIT_NOT_ASSIGNED"],
    );
    assert.deepEqual(
      evaluateCheckInEligibility({ ...record, bookingStatus: "DRAFT" }, now, true).reasons,
      ["INVALID_BOOKING_STATUS"],
    );
    assert.deepEqual(
      evaluateCheckInEligibility({ ...record, checkInDayEnd: null }, now, true).reasons,
      ["CHECKIN_SLOT_NOT_CONFIGURED"],
    );
    assert.deepEqual(evaluateCheckInEligibility(record, record.checkInDayEnd, true).reasons, [
      "DEADLINE_PASSED",
    ]);
  });
});
