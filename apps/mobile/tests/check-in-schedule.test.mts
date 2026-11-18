import { expect, test } from "bun:test";
import type { CheckInSlotOption } from "@metastorage/contracts";
import { canSelectCheckInSlot, firstCheckInDate } from "../src/common/check-in-schedule.utils";

const slots: CheckInSlotOption[] = ["08:00:00", "10:30:00", "14:00:00", "15:30:00"].map(
  (startTime, index) => ({
    id: String(index),
    name: `Ca ${index + 1}`,
    startTime,
    endTime: "17:00:00",
    sameDayCheckInEnabled: false,
  }),
);

function slotAt(startTime: string) {
  const slot = slots.find((item) => item.startTime === startTime);
  if (!slot) throw new Error(`Missing test slot ${startTime}`);
  return slot;
}

test("keeps today while a future shift remains, then disables today at the last shift start", () => {
  expect(firstCheckInDate(slots, new Date("2026-11-03T15:29:59+07:00"))).toBe("2026-11-03");
  expect(firstCheckInDate(slots, new Date("2026-11-03T15:30:00+07:00"))).toBe("2026-11-04");
  expect(firstCheckInDate(slots, new Date("2026-11-03T23:30:00+07:00"))).toBe("2026-11-04");
});

test("blocks started shifts and past dates, but allows future dates in Vietnam time", () => {
  const now = new Date("2026-11-03T10:30:00+07:00");
  expect(canSelectCheckInSlot("2026-11-03", slotAt("10:30:00"), now)).toBe(false);
  expect(canSelectCheckInSlot("2026-11-03", slotAt("14:00:00"), now)).toBe(true);
  expect(canSelectCheckInSlot("2026-11-02", slotAt("15:30:00"), now)).toBe(false);
  expect(canSelectCheckInSlot("2026-11-04", slotAt("08:00:00"), now)).toBe(true);
  expect(canSelectCheckInSlot("", slotAt("08:00:00"), now)).toBe(false);
  expect(firstCheckInDate(slots, new Date("2026-11-03T00:30:00+07:00"))).toBe("2026-11-03");
});

test("keeps the same-day demo slot selectable until it ends", () => {
  const demoSlot: CheckInSlotOption = {
    id: "demo",
    name: "Demo check-in ngay",
    startTime: "08:00:00",
    endTime: "23:59:59.999",
    sameDayCheckInEnabled: true,
  };

  expect(canSelectCheckInSlot("2026-11-03", demoSlot, new Date("2026-11-03T10:30:00+07:00"))).toBe(
    true,
  );
  expect(
    canSelectCheckInSlot("2026-11-03", demoSlot, new Date("2026-11-03T23:59:59.999+07:00")),
  ).toBe(false);
});
