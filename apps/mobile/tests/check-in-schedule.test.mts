import { expect, test } from "bun:test";
import type { CheckInSlotOption } from "@metastorage/contracts";
import { canSelectCheckInSlot } from "../src/common/check-in-schedule.utils";

test("keeps the same-day demo slot selectable all day, ignoring its time window", () => {
  const demoSlot: CheckInSlotOption = {
    id: "demo",
    name: "Demo check-in ngay",
    startTime: "16:55:00",
    endTime: "20:00:00",
    sameDayCheckInEnabled: true,
  };

  for (const time of ["08:00:00", "18:00:00", "22:30:00"])
    expect(canSelectCheckInSlot("2026-11-03", demoSlot, new Date(`2026-11-03T${time}+07:00`))).toBe(
      true,
    );
  expect(canSelectCheckInSlot("2026-11-02", demoSlot, new Date("2026-11-03T10:30:00+07:00"))).toBe(
    false,
  );
});

test("an ordinary slot still closes when it ends", () => {
  const slot: CheckInSlotOption = {
    id: "ca-1",
    name: "Ca 1",
    startTime: "09:00:00",
    endTime: "10:30:00",
    sameDayCheckInEnabled: false,
  };

  expect(canSelectCheckInSlot("2026-11-03", slot, new Date("2026-11-03T10:00:00+07:00"))).toBe(
    true,
  );
  expect(canSelectCheckInSlot("2026-11-03", slot, new Date("2026-11-03T10:30:00+07:00"))).toBe(
    false,
  );
});
