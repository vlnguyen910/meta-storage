import { describe, expect, test } from "bun:test";
import { CheckInSlotsService } from "../../src/modules/appointments/check-in-slots.service";
import type { ResolvedCheckInSlot } from "../../src/modules/appointments/check-in-slots.types";

const service = new CheckInSlotsService({} as never);
const today = "2026-11-18";
const slot = (sameDayCheckInEnabled: boolean): ResolvedCheckInSlot => ({
  id: "slot",
  sameDayCheckInEnabled,
  startsAt: new Date(`${today}T16:55:00+07:00`),
  endsAt: new Date(`${today}T20:00:00+07:00`),
});
const before = new Date(`${today}T08:00:00+07:00`);
const during = new Date(`${today}T18:00:00+07:00`);
const after = new Date(`${today}T22:30:00+07:00`);

describe("same-day check-in slots", () => {
  test("a flagged slot ignores its time window for the current day", () => {
    for (const now of [before, during, after]) {
      expect(service.allowsSameDayReservation(slot(true), today, now)).toBe(true);
      expect(service.allowsCheckInDuringSameDaySlot(slot(true), today, now)).toBe(true);
    }
  });

  test("a flagged slot is still limited to the current day", () => {
    expect(service.allowsSameDayReservation(slot(true), "2026-11-19", during)).toBe(false);
    expect(service.allowsSameDayReservation(slot(true), "2026-11-17", during)).toBe(false);
    expect(service.allowsCheckInDuringSameDaySlot(slot(true), "2026-11-19", during)).toBe(false);
  });

  test("an unflagged slot keeps the existing rules", () => {
    expect(service.allowsSameDayReservation(slot(false), today, before)).toBe(true);
    expect(service.allowsSameDayReservation(slot(false), today, after)).toBe(false);
    expect(service.allowsCheckInDuringSameDaySlot(slot(false), today, during)).toBe(false);
  });

  test("same-day appointments (returns) still end with the slot, flagged or not", () => {
    expect(service.allowsSameDayAppointment(slot(true), today, after)).toBe(false);
    expect(service.allowsSameDayAppointment(slot(true), today, during)).toBe(true);
  });
});
