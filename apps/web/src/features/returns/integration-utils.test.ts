import { describe, expect, it } from "vitest";
import {
  facilityDateTime,
  facilityTimeToIso,
  minuteClock,
  money,
  readWholeVnd,
} from "./integration-utils";

describe("facility return times", () => {
  it("interprets a facility wall-clock value without using the browser timezone", () => {
    expect(facilityTimeToIso("2026-10-22T14:30", "Asia/Ho_Chi_Minh")).toBe(
      "2026-10-22T07:30:00.000Z",
    );
    expect(facilityDateTime("2026-10-22T07:30:00.000Z", "Asia/Ho_Chi_Minh")).toBe(
      "2026-10-22T14:30",
    );
  });
  it("handles dates crossing UTC midnight and negative offsets", () => {
    expect(facilityTimeToIso("2026-10-22T02:00", "Asia/Ho_Chi_Minh")).toBe(
      "2026-10-21T19:00:00.000Z",
    );
    expect(facilityTimeToIso("2026-01-15T18:00", "America/New_York")).toBe(
      "2026-01-15T23:00:00.000Z",
    );
  });
  it("rejects nonexistent daylight saving times instead of silently moving the appointment", () => {
    expect(() => facilityTimeToIso("2026-03-08T02:30", "America/New_York")).toThrow();
  });
});

describe("VND values received from the API", () => {
  it("reads database numeric strings without floating point loss", () => {
    expect(readWholeVnd("1800000.00")).toBe(1800000n);
    expect(readWholeVnd("9007199254740993.00")).toBe(9007199254740993n);
    expect(money("1800000.00")).toBe("1.800.000 ₫");
  });
  it("refuses fractional, malformed or negative financial facts instead of rounding", () => {
    for (const value of ["1.50", "", "-5", "NaN", "1000 VND"])
      expect(readWholeVnd(value)).toBeNull();
  });
});

it("normalizes only zero SQL seconds for the minute-based calendar contract", () => {
  expect(minuteClock("08:00:00")).toBe("08:00");
  expect(minuteClock("08:30:00.000")).toBe("08:30");
  expect(minuteClock("08:30")).toBe("08:30");
  expect(minuteClock("08:30:15")).toBe("08:30:15");
});
