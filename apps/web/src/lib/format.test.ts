import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatDateTime } from "./format";

describe("Vietnamese display formats", () => {
  it("formats VND without fractional digits", () => {
    expect(formatCurrency(1_500_000)).toMatch(/1\.500\.000/);
  });

  it("formats ISO dates as dd/MM/yyyy", () => {
    expect(formatDate("2026-09-19T00:00:00.000Z")).toBe("19/09/2026");
  });

  it("formats Vietnam time using a 24-hour clock", () => {
    expect(formatDateTime("2026-09-28T19:08:00.000Z")).toContain("02:08");
    expect(formatDateTime("2026-09-29T07:08:00.000Z")).toContain("14:08");
  });
});
