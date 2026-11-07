import { afterEach, describe, expect, it, vi } from "vitest";
import { createSeedDatabase } from "../seeds";
import { remainingCapacity } from "./availability";

const facility = "fac-hcm-central";
const type = "00000000-0000-0000-0001-000000000001";
const start = "2026-10-14T02:00:00.000Z";
const end = "2026-11-14T02:00:00.000Z";
const hold = {
  draftId: "another-draft",
  holdId: "hold",
  holdToken: "token",
  unitTypeId: type,
  startsAt: start,
  endsAt: end,
  expiresAt: "2026-10-13T09:10:00.000Z",
  status: "ACTIVE" as const,
};
afterEach(() => vi.restoreAllMocks());

// Keep three free 2 m² units so seed expansion does not change policy cases.
function capacityFixture() {
  const database = createSeedDatabase();
  let kept = 0;
  database.units = database.units.filter((unit) => {
    if (unit.unitTypeId !== type || unit.status !== "AVAILABLE") return true;
    return kept++ < 3;
  });
  return database;
}

describe("remaining mock capacity", () => {
  it("subtracts overlapping unassigned bookings and clamps exhausted capacity to zero", () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-13T09:00:00.000Z"));
    const database = capacityFixture();
    expect(remainingCapacity(database, facility, type, start, end)).toBe(1);
    database.holds.push(hold, { ...hold, draftId: "third-draft" });
    expect(remainingCapacity(database, facility, type, start, end)).toBe(0);
  });
  it("releases expired holds and keeps the current customer's valid hold usable", () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-13T09:00:00.000Z"));
    const database = capacityFixture();
    database.holds.push(hold);
    expect(remainingCapacity(database, facility, type, start, end)).toBe(0);
    expect(remainingCapacity(database, facility, type, start, end, hold.draftId)).toBe(1);
    database.holds[0] = { ...hold, expiresAt: "2026-10-13T08:59:00.000Z" };
    expect(remainingCapacity(database, facility, type, start, end)).toBe(1);
  });
  it("does not block a later non-overlapping rental period or count cancelled bookings", () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-13T09:00:00.000Z"));
    const database = capacityFixture();
    expect(
      remainingCapacity(
        database,
        facility,
        type,
        "2030-01-01T00:00:00.000Z",
        "2030-02-01T00:00:00.000Z",
      ),
    ).toBe(3);
    for (const booking of database.bookings) {
      if (booking.unitTypeId === type && !booking.assignedUnit) booking.status = "CANCELLED";
    }
    expect(remainingCapacity(database, facility, type, start, end)).toBe(3);
  });
});
