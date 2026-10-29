import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateCheckInReadiness,
  getCheckInDeadlineAt,
  getCheckInOpensAt,
} from "../../../src/modules/bookings/booking-check-in.policy";
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
  it("allows a paid assigned booking until CLOSING_HOUR and rejects the cutoff itself", () => {
    const start = new Date("2026-12-15T02:00:00.000Z");
    const record = {
      bookingStatus: "CONFIRMED",
      payment: { status: "SUCCEEDED" },
      hasAssignedUnit: true,
      checkInOpensAt: new Date("2026-12-15T01:00:00.000Z"),
      checkInSlotStart: start,
      checkInDeadline: new Date("2026-12-15T11:00:00.000Z"),
    };
    const during = evaluateCheckInReadiness(record, new Date("2026-12-15T03:00:00.000Z"));
    assert.equal(during.canProceed, true);
    assert.equal(
      evaluateCheckInReadiness(record, new Date("2026-12-15T01:30:00.000Z")).canProceed,
      true,
    );
    assert.deepEqual(
      evaluateCheckInReadiness(record, new Date("2026-12-15T00:59:59.000Z")).reasons,
      ["TOO_EARLY"],
    );
    assert.equal(during.checkInDeadlineAt?.toISOString(), "2026-12-15T11:00:00.000Z");
    assert.equal(
      evaluateCheckInReadiness(record, new Date("2026-12-15T09:00:00.000Z")).canProceed,
      true,
    );
    assert.deepEqual(
      evaluateCheckInReadiness(record, new Date("2026-12-15T11:00:00.000Z")).reasons,
      ["DEADLINE_PASSED"],
    );
  });
  it("allows before the slot on the booking date but blocks before that date", () => {
    const record = {
      bookingStatus: "CONFIRMED",
      payment: { status: "SUCCEEDED" },
      hasAssignedUnit: true,
      checkInOpensAt: new Date("2026-12-16T01:00:00Z"),
      checkInSlotStart: new Date("2026-12-16T02:00:00Z"),
      checkInDeadline: new Date("2026-12-16T13:00:00Z"),
    };
    const now = new Date("2026-12-15T03:00:00Z");
    assert.deepEqual(evaluateCheckInReadiness(record, now).reasons, ["TOO_EARLY"]);
    assert.equal(evaluateCheckInReadiness(record, now, true).canProceed, true);
    assert.equal(
      evaluateCheckInReadiness(record, new Date("2026-12-16T01:00:00Z")).canProceed,
      true,
    );
    assert.equal(evaluateCheckInReadiness(record, record.checkInDeadline, true).canProceed, true);
    assert.deepEqual(
      evaluateCheckInReadiness(
        { ...record, payment: { status: "PENDING" }, hasAssignedUnit: false },
        now,
      ).reasons,
      ["PAYMENT_NOT_SUCCEEDED", "UNIT_NOT_ASSIGNED", "TOO_EARLY"],
    );
    assert.deepEqual(evaluateCheckInReadiness({ ...record, bookingStatus: "DRAFT" }, now).reasons, [
      "INVALID_BOOKING_STATUS",
      "TOO_EARLY",
    ]);
    assert.deepEqual(evaluateCheckInReadiness({ ...record, checkInDeadline: null }, now).reasons, [
      "CHECKIN_SLOT_NOT_CONFIGURED",
    ]);
    assert.deepEqual(evaluateCheckInReadiness(record, record.checkInDeadline).reasons, [
      "DEADLINE_PASSED",
    ]);
  });
  it("uses OPENING_HOUR and CLOSING_HOUR on the booking's Vietnam date", () => {
    assert.equal(getCheckInOpensAt("2026-12-15", 8).toISOString(), "2026-12-15T01:00:00.000Z");
    assert.equal(getCheckInDeadlineAt("2026-12-15", 20).toISOString(), "2026-12-15T13:00:00.000Z");
    assert.equal(getCheckInDeadlineAt("2026-12-15", 24).toISOString(), "2026-12-15T17:00:00.000Z");
  });
});
