import { expect, test } from "bun:test";
import { appointment, appointments } from "../e2e/customer-home.data";
import {
  appointmentTiming,
  matchesAppointmentFilter,
  nextCheckIn,
  shiftDate,
  vietnamDate,
  weekStart,
} from "../src/common/customer-home.utils";

test("calendar keeps Vietnam's date and week boundaries across month/year transitions", () => {
  expect(vietnamDate(Date.parse("2026-12-31T18:00:00Z"))).toBe("2027-01-01");
  expect(weekStart("2027-01-01")).toBe("2026-12-27");
  expect(shiftDate("2026-12-27", 7)).toBe("2027-01-03");
});
test("upcoming checks exclude closed appointments and keep an ongoing time slot", () => {
  const during = Date.parse("2026-11-06T06:30:00Z");
  expect(nextCheckIn([...appointments].reverse(), during)?.id).toBe(appointment.id);
  expect(appointmentTiming(appointment, during)).toBe("Đang trong khung giờ");
  expect(nextCheckIn([appointment], Date.parse("2026-11-06T08:00:00Z"))).toBeUndefined();
  expect(matchesAppointmentFilter(appointments[3], "upcoming", during)).toBe(false);
  expect(matchesAppointmentFilter(appointments[3], "closed", during)).toBe(true);
});
