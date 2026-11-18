import { expect, test } from "bun:test";
import type { CheckInSlotOption } from "@metastorage/contracts";
import { canSelectCheckInSlot } from "../src/common/check-in-schedule.utils";

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
