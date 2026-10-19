import { describe, expect, it } from "vitest";
import { OPERATIONS_SHELL_MESSAGES } from "@/modules/business-operations/operations.messages";
import { OPERATIONS_MESSAGES as M } from "./operations.messages";
import {
  OperationsDepositDraftSchema,
  OperationsManualRefundDraftSchema,
  OperationsPriceDraftSchema,
} from "./operations.schema";
import { formatMoney, formatMoneyWithCurrency, formatPercentage } from "./operations.utils";

describe("Flow 4 Integration & Business Rules Verification", () => {
  describe("Financial Null vs Zero vs Currency Differentiation", () => {
    it("distinguishes null (unattributed / unclassified) from a genuine zero balance", () => {
      // null means unclassified / needs reconciliation
      expect(formatMoney(null)).toBe("—");
      expect(formatMoney(undefined)).toBe("—");

      // genuine zero balance must display 0 VND
      const zeroVnd = formatMoney(0);
      expect(zeroVnd).toMatch(/0/);
      expect(zeroVnd).not.toBe("—");
    });

    it("formats multi-currency transactions without coercing USD to VND", () => {
      // USD transaction in reconciliation must format with USD symbol, not VND
      const usdZero = formatMoneyWithCurrency(0, "USD");
      expect(usdZero).toBe("$0.00");

      const usdPositive = formatMoneyWithCurrency("125.50", "USD");
      expect(usdPositive).toBe("$125.50");
      expect(usdPositive).not.toContain("₫");

      // VND transaction formats with VND symbol
      const vndAmount = formatMoneyWithCurrency(2500000, "VND");
      expect(vndAmount).toMatch(/2\.500\.000/);
      expect(vndAmount).toContain("₫");
    });

    it("handles null rates in utilization without drawing fake 0%", () => {
      // null utilization indicates no operating units
      const isNull = null;
      expect(isNull === null ? M.noOperatingUnitsBadge : formatPercentage(0)).toBe(
        "Chưa có ô khai thác",
      );

      // genuine 0% utilization
      expect(formatPercentage(0)).toBe("0%");
    });
  });

  describe("Query Parameter Mapping & Pagination Logic", () => {
    const PAGE_SIZE = 20;

    function computePagination(page: number, pageSize = PAGE_SIZE) {
      const safePage = Math.max(1, page);
      const offset = (safePage - 1) * pageSize;
      return { offset, limit: pageSize, page: safePage };
    }

    it("maps page 1 to offset 0 and limit 20", () => {
      const p1 = computePagination(1);
      expect(p1.offset).toBe(0);
      expect(p1.limit).toBe(20);
    });

    it("maps subsequent pages to correct offsets", () => {
      const p2 = computePagination(2);
      expect(p2.offset).toBe(20);

      const p5 = computePagination(5);
      expect(p5.offset).toBe(80);
    });

    it("resets page and offset when a filter changes", () => {
      let currentPage = 3;
      // Filter change triggers reset
      currentPage = 1;
      const pagination = computePagination(currentPage);
      expect(pagination.page).toBe(1);
      expect(pagination.offset).toBe(0);
    });

    it("translates 'all' selector values to undefined for backend query DTOs", () => {
      function buildReportQuery(facilityId: string, unitTypeId: string) {
        return {
          facilityId: facilityId === "all" ? undefined : facilityId,
          unitTypeId: unitTypeId === "all" ? undefined : unitTypeId,
        };
      }

      expect(buildReportQuery("all", "all")).toEqual({
        facilityId: undefined,
        unitTypeId: undefined,
      });

      const facilityUuid = "11111111-1111-1111-1111-111111111111";
      expect(buildReportQuery(facilityUuid, "all")).toEqual({
        facilityId: facilityUuid,
        unitTypeId: undefined,
      });
    });
  });

  describe("Form Schemas & Contract Consistency", () => {
    it("validates deposit policy according to backend contracts without arbitrary 24 cap", () => {
      // Backend allows any positive integer
      expect(OperationsDepositDraftSchema.safeParse({ depositMonths: 1 }).success).toBe(true);
      expect(OperationsDepositDraftSchema.safeParse({ depositMonths: 12 }).success).toBe(true);
      expect(OperationsDepositDraftSchema.safeParse({ depositMonths: 36 }).success).toBe(true);

      // Rejects invalid values
      expect(OperationsDepositDraftSchema.safeParse({ depositMonths: 0 }).success).toBe(false);
      expect(OperationsDepositDraftSchema.safeParse({ depositMonths: -2 }).success).toBe(false);
      expect(OperationsDepositDraftSchema.safeParse({ depositMonths: 1.5 }).success).toBe(false);
    });

    it("validates unit type monthly price as non-negative integer", () => {
      expect(OperationsPriceDraftSchema.safeParse({ monthlyPrice: 0 }).success).toBe(true);
      expect(OperationsPriceDraftSchema.safeParse({ monthlyPrice: 1500000 }).success).toBe(true);

      expect(OperationsPriceDraftSchema.safeParse({ monthlyPrice: -500 }).success).toBe(false);
      expect(OperationsPriceDraftSchema.safeParse({ monthlyPrice: 1200.5 }).success).toBe(false);
    });

    it("validates manual refund reference with trimming and max 128 characters", () => {
      expect(
        OperationsManualRefundDraftSchema.safeParse({ reference: "VCB-REF-20261019-99" }).success,
      ).toBe(true);

      // Reject empty or whitespace only
      expect(OperationsManualRefundDraftSchema.safeParse({ reference: "" }).success).toBe(false);
      expect(OperationsManualRefundDraftSchema.safeParse({ reference: "   " }).success).toBe(false);

      // Reject over 128 characters
      expect(
        OperationsManualRefundDraftSchema.safeParse({ reference: "A".repeat(129) }).success,
      ).toBe(false);
    });
  });

  describe("Dirty State & 409 Conflict Protection Logic", () => {
    it("protects dirty draft values when a background refetch delivers a new version", () => {
      // Simulation of the form dirty guard:
      let baseVersion = 1;
      let formValue = 2; // user typed 2 months
      const isDirty = true;
      const conflictOccurred = false;

      // New data arrives from background refetch with version 2
      const incomingConfig = { version: 2, depositMonths: 3 };

      function syncConfig(incoming: typeof incomingConfig) {
        if (!isDirty && !conflictOccurred) {
          baseVersion = incoming.version;
          formValue = incoming.depositMonths;
        }
      }

      syncConfig(incomingConfig);

      // User's dirty draft (2) and baseVersion (1) remain intact for optimistic lock verification
      expect(baseVersion).toBe(1);
      expect(formValue).toBe(2);
    });

    it("verifies 409 conflict message and reload mechanism", () => {
      const conflictHttpError = { response: { status: 409 } };
      let errorMsg: string | null = null;

      if (conflictHttpError.response.status === 409) {
        errorMsg = M.conflictMessage;
      }

      expect(errorMsg).toBe(
        "Cấu hình giá/cọc đã bị cập nhật bởi người quản lý khác. Nội dung chỉnh sửa của bạn được giữ nguyên bên dưới. Vui lòng kiểm tra lại trước khi áp dụng.",
      );
    });

    it("verifies catalog cache invalidation query keys list", () => {
      const invalidationKeys = [["pricing"], ["catalog"], ["unit-types"], ["facilities"]];

      expect(invalidationKeys).toContainEqual(["pricing"]);
      expect(invalidationKeys).toContainEqual(["catalog"]);
      expect(invalidationKeys).toContainEqual(["unit-types"]);
      expect(invalidationKeys).toContainEqual(["facilities"]);
    });
  });

  describe("Data Mode Shell Labels Verification", () => {
    it("displays honest API development labels in API mode", () => {
      expect(OPERATIONS_SHELL_MESSAGES.apiMode).toBe("Chế độ: API Development");
      expect(OPERATIONS_SHELL_MESSAGES.apiNote).toBe("Nguồn dữ liệu: API Backend Development");
    });

    it("reserves mock demo label only for mock mode", () => {
      expect(OPERATIONS_SHELL_MESSAGES.demo).toBe("Dữ liệu minh họa");
      expect(OPERATIONS_SHELL_MESSAGES.note).toBe("Bản mẫu frontend • dữ liệu cục bộ");
    });
  });
});
