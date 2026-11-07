import { describe, expect, it } from "vitest";
import { operationsMockData, operationsTypeMetrics } from "./operations.mock";
import { filterFacilities, summarizeFacilities, toCsv } from "./operations.utils";

describe("BOM mock reporting", () => {
  it("unit-type breakdowns reconcile to each facility's mock totals", () => {
    for (const facility of operationsMockData.facilities) {
      const metrics = Object.values(operationsTypeMetrics[facility.id] ?? {});
      for (const field of [
        "total",
        "occupied",
        "available",
        "reserved",
        "maintenance",
        "rentalCollected",
        "depositHeld",
      ] as const) {
        expect(metrics.reduce((sum, item) => sum + item[field], 0)).toBe(facility[field]);
      }
    }
  });
  it("keeps capacity and cash totals consistent across the mock reports", () => {
    const totals = summarizeFacilities(operationsMockData.facilities);
    expect(totals).toMatchObject({
      total: 360,
      occupied: 272,
      available: 50,
      reserved: 20,
      maintenance: 18,
      rentalCollected: 336_000_000,
      depositHeld: 190_000_000,
    });
    expect(totals.occupancy).toBeCloseTo(75.555555, 4);
  });

  it("filters reports by facility and returns an empty result for a missing name", () => {
    const selected = filterFacilities(operationsMockData.facilities, "SGC", "");
    expect(selected).toHaveLength(1);
    expect(summarizeFacilities(selected).rentalCollected).toBe(120_000_000);
    expect(filterFacilities(operationsMockData.facilities, "all", "not-a-facility")).toEqual([]);
  });

  it("escapes CSV fields and prevents spreadsheet formulas in user-entered names", () => {
    expect(
      toCsv([
        ["name", "amount"],
        ["a,b", 12],
        ["=SUM(A1)", 0],
      ]),
    ).toBe('\uFEFF"name","amount"\r\n"a,b","12"\r\n"\'=SUM(A1)","0"');
  });
});
