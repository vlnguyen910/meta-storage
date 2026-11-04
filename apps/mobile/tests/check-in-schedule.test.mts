import { expect, test } from "bun:test";
import type { CheckInSlotOption } from "@metastorage/contracts";
import {
  canSelectCheckInSlot,
  firstCheckInDate,
} from "../src/features/customer-api/check-in-schedule";

const slots: CheckInSlotOption[] = ["08:00:00", "10:30:00", "14:00:00", "15:30:00"].map(
  (startTime, index) => ({
    id: String(index),
    name: `Ca ${index + 1}`,
    startTime,
    endTime: "17:00:00",
  }),
);

test("keeps today while a future shift remains, then disables today at the last shift start", () => {
  expect(firstCheckInDate(slots, new Date("2026-11-03T15:29:59+07:00"))).toBe("2026-11-03");
  expect(firstCheckInDate(slots, new Date("2026-11-03T15:30:00+07:00"))).toBe("2026-11-04");
  expect(firstCheckInDate(slots, new Date("2026-11-03T23:30:00+07:00"))).toBe("2026-11-04");
});

test("blocks started shifts and past dates, but allows future dates in Vietnam time", () => {
  const now = new Date("2026-11-03T10:30:00+07:00");
  expect(canSelectCheckInSlot("2026-11-03", "10:30:00", now)).toBe(false);
  expect(canSelectCheckInSlot("2026-11-03", "14:00:00", now)).toBe(true);
  expect(canSelectCheckInSlot("2026-11-02", "15:30:00", now)).toBe(false);
  expect(canSelectCheckInSlot("2026-11-04", "08:00:00", now)).toBe(true);
  expect(canSelectCheckInSlot("", "08:00:00", now)).toBe(false);
  expect(firstCheckInDate(slots, new Date("2026-11-03T00:30:00+07:00"))).toBe("2026-11-03");
});
