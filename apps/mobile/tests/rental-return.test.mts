import { expect, test } from "bun:test";
import { APPOINTMENT_TYPES, CreateAppointmentSchema } from "@metastorage/contracts";
import { isEarlyReturn } from "../src/common/my-storage.utils";

const endAt = "2026-12-10T10:00:00+07:00";
const id = "349e7bf5-5d3b-4e37-9ba0-ab45f3cdac6d";

test("return before the rental end day is early", () => {
  expect(isEarlyReturn("2026-12-09", endAt)).toBe(true);
});

test("return on or after the rental end day is not early", () => {
  expect(isEarlyReturn("2026-12-10", endAt)).toBe(false);
  expect(isEarlyReturn("2026-12-11", endAt)).toBe(false);
});

test("end day uses GMT+7, not UTC", () => {
  expect(isEarlyReturn("2026-12-10", "2026-12-09T20:00:00Z")).toBe(false);
});

test("customer return request matches the API contract", () => {
  const input = {
    appointmentType: APPOINTMENT_TYPES.CHECK_OUT,
    rentalId: id,
    scheduledDate: "2026-12-10",
    slotId: id,
  };
  expect(CreateAppointmentSchema.safeParse(input).success).toBe(true);
});
