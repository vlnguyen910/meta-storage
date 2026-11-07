import { describe, expect, test } from "bun:test";
import {
  csvCell,
  formatCents,
  parseCents,
  resolveReportPeriod,
} from "../../src/modules/reports/reports.calculation";

describe("report boundaries and exact money", () => {
  test("defaults to Vietnam month-to-date and uses a half-open UTC range", () => {
    const p = resolveReportPeriod({}, new Date("2026-10-31T18:00:00Z"));
    expect(p.from).toBe("2026-11-01");
    expect(p.to).toBe("2026-11-01");
    expect(p.start.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-11-01T17:00:00.000Z");
  });
  test("adds amounts exactly and allows a negative net cash period", () => {
    expect(formatCents(parseCents("999999999999.99") + parseCents("0.01"))).toBe(
      "1000000000000.00",
    );
    expect(formatCents(parseCents("0") - parseCents("3000000.00"))).toBe("-3000000.00");
  });
  test("quotes CSV names and blocks formulas without corrupting numeric negatives", () => {
    expect(csvCell("=SUM(1,2)")).toBe('"\'=SUM(1,2)"');
    expect(csvCell('Kho "A", B')).toBe('"Kho ""A"", B"');
    expect(csvCell("-100.50")).toBe('"-100.50"');
  });
});
