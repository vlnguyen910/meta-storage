import { describe, expect, test } from "bun:test";
import type { ReportsRepository } from "../../src/modules/reports/reports.repository";
import { ReportsService } from "../../src/modules/reports/reports.service";

describe("monthly cash reporting", () => {
  test("keeps collection and refund months separate and fills months with no activity", async () => {
    const repository = {
      monthlyRevenue: async () => ({
        receipts: [
          {
            month: "2026-01",
            cashReceived: "120.00",
            rentalCollected: "100.00",
            depositCollected: "20.00",
            unclassified: 0,
            unsupportedCurrencyPayments: 0,
          },
        ],
        refunds: [{ month: "2026-03", cashRefunded: "120.00" }],
      }),
    } as unknown as ReportsRepository;
    const result = await new ReportsService(repository).monthlyRevenue(
      { from: "2026-01-01", to: "2026-03-31" },
      { id: "test-bom", role: "BUSINESS_OPERATION_MANAGER" },
    );
    expect(result.items.map((item) => item.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(result.items[0]?.rentalCollected).toBe("100.00");
    expect(result.items[1]?.cashReceived).toBe("0.00");
    expect(result.items[2]?.netCash).toBe("-120.00");
  });
  test("preserves unknown receipt classifications instead of inventing zero rent", async () => {
    const repository = {
      monthlyRevenue: async () => ({
        receipts: [
          {
            month: "2026-02",
            cashReceived: "50.00",
            rentalCollected: "0.00",
            depositCollected: "0.00",
            unclassified: 1,
            unsupportedCurrencyPayments: 0,
          },
        ],
        refunds: [],
      }),
    } as unknown as ReportsRepository;
    const result = await new ReportsService(repository).monthlyRevenue(
      { from: "2026-02-01", to: "2026-02-28" },
      { id: "test-bom", role: "BUSINESS_OPERATION_MANAGER" },
    );
    expect(result.items[0]?.cashReceived).toBe("50.00");
    expect(result.items[0]?.rentalCollected).toBeNull();
    expect(result.items[0]?.depositCollected).toBeNull();
  });
});
