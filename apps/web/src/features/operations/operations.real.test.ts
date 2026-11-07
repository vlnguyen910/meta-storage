import { describe, expect, it } from "vitest";
import { OPERATIONS_SHELL_MESSAGES } from "@/modules/business-operations/operations.messages";
import {
  OperationsDepositDraftSchema,
  OperationsManualRefundDraftSchema,
  OperationsPriceDraftSchema,
} from "./operations.schema";
import {
  formatDateTimeVn,
  formatDateVn,
  formatMoney,
  formatMoneyWithCurrency,
  formatPercentage,
  getDefaultPeriod,
} from "./operations.utils";

describe("Real Operations Utilities and Schemas", () => {
  describe("formatMoney", () => {
    it("formats VND currency amounts correctly", () => {
      expect(formatMoney(1000000)).toMatch(/1\.000\.000/);
      expect(formatMoney("2500000")).toMatch(/2\.500\.000/);
    });

    it("returns dash for null or undefined without throwing or defaulting to 0", () => {
      expect(formatMoney(null)).toBe("—");
      expect(formatMoney(undefined)).toBe("—");
      expect(formatMoney("invalid-number")).toBe("—");
    });
  });

  describe("formatMoneyWithCurrency", () => {
    it("formats VND with Vietnamese currency symbol", () => {
      expect(formatMoneyWithCurrency(1500000, "VND")).toMatch(/1\.500\.000/);
      expect(formatMoneyWithCurrency("1500000", "vnd")).toMatch(/1\.500\.000/);
    });

    it("formats USD with US Dollar symbol and 2 decimal places without forcing VND", () => {
      const formatted = formatMoneyWithCurrency(50, "USD");
      expect(formatted).toMatch(/\$50\.00/);
      expect(formatted).not.toContain("₫");
    });

    it("handles null or undefined by returning dash", () => {
      expect(formatMoneyWithCurrency(null, "USD")).toBe("—");
      expect(formatMoneyWithCurrency(undefined, "VND")).toBe("—");
    });
  });

  describe("formatPercentage", () => {
    it("formats percentage correctly with 1 fraction digit", () => {
      expect(formatPercentage(75.555)).toBe("75,6%");
      expect(formatPercentage(100)).toBe("100%");
    });
  });

  describe("formatDateVn and formatDateTimeVn", () => {
    it("formats ISO date-times in Asia/Ho_Chi_Minh time zone", () => {
      const formatted = formatDateVn("2026-10-15T03:00:00Z");
      expect(formatted).toBe("15/10/2026");

      expect(formatDateVn(null)).toBe("—");
      expect(formatDateVn(undefined)).toBe("—");
    });

    it("formats date-times with time components", () => {
      const formatted = formatDateTimeVn("2026-10-15T03:00:00Z");
      expect(formatted).not.toBe("—");
      expect(formatDateTimeVn(null)).toBe("—");
    });
  });

  describe("getDefaultPeriod", () => {
    it("returns from the first day of current month to current day", () => {
      const period = getDefaultPeriod();
      expect(period.from).toMatch(/^\d{4}-\d{2}-01$/);
      expect(period.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(period.from).getTime()).toBeLessThanOrEqual(new Date(period.to).getTime());
    });
  });

  describe("OperationsPriceDraftSchema", () => {
    it("accepts valid positive integer prices", () => {
      expect(OperationsPriceDraftSchema.safeParse({ monthlyPrice: 5000000 }).success).toBe(true);
      expect(OperationsPriceDraftSchema.safeParse({ monthlyPrice: 1 }).success).toBe(true);
    });

    it("rejects zero, negative prices and non-integer prices", () => {
      expect(OperationsPriceDraftSchema.safeParse({ monthlyPrice: 0 }).success).toBe(false);
      expect(OperationsPriceDraftSchema.safeParse({ monthlyPrice: -1000 }).success).toBe(false);
      expect(OperationsPriceDraftSchema.safeParse({ monthlyPrice: 12.5 }).success).toBe(false);
    });
  });

  describe("OperationsDepositDraftSchema", () => {
    it("validates positive integer deposit months and does not arbitrarily cap at 24", () => {
      expect(OperationsDepositDraftSchema.safeParse({ depositMonths: 2 }).success).toBe(true);
      expect(OperationsDepositDraftSchema.safeParse({ depositMonths: 36 }).success).toBe(true);
    });

    it("rejects zero, negative numbers and floats", () => {
      expect(OperationsDepositDraftSchema.safeParse({ depositMonths: 0 }).success).toBe(false);
      expect(OperationsDepositDraftSchema.safeParse({ depositMonths: -1 }).success).toBe(false);
      expect(OperationsDepositDraftSchema.safeParse({ depositMonths: 1.5 }).success).toBe(false);
    });
  });

  describe("OperationsManualRefundDraftSchema", () => {
    it("validates bank reference code", () => {
      const valid = OperationsManualRefundDraftSchema.safeParse({
        reference: "FT26101900123456",
      });
      expect(valid.success).toBe(true);

      const empty = OperationsManualRefundDraftSchema.safeParse({
        reference: "   ",
      });
      expect(empty.success).toBe(false);
    });
  });

  describe("Shell Mode Messages", () => {
    it("defines distinct labels for API mode vs mock mode", () => {
      expect(OPERATIONS_SHELL_MESSAGES.apiMode).toBe("Chế độ: API Development");
      expect(OPERATIONS_SHELL_MESSAGES.demo).toBe("Dữ liệu minh họa");
      expect(OPERATIONS_SHELL_MESSAGES.apiNote).toContain("API Backend Development");
    });
  });
});
