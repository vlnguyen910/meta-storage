import { describe, expect, it } from "vitest";
import {
  OperationsDepositDraftSchema,
  OperationsManualRefundDraftSchema,
} from "./operations.schema";
import {
  formatDateTimeVn,
  formatDateVn,
  formatMoney,
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

  describe("OperationsDepositDraftSchema", () => {
    it("validates positive integer deposit months", () => {
      const valid = OperationsDepositDraftSchema.safeParse({
        depositMonths: 2,
      });
      expect(valid.success).toBe(true);

      const invalidZero = OperationsDepositDraftSchema.safeParse({
        depositMonths: 0,
      });
      expect(invalidZero.success).toBe(false);

      const invalidNegative = OperationsDepositDraftSchema.safeParse({
        depositMonths: -1,
      });
      expect(invalidNegative.success).toBe(false);

      const invalidNonInt = OperationsDepositDraftSchema.safeParse({
        depositMonths: 1.5,
      });
      expect(invalidNonInt.success).toBe(false);
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
});
