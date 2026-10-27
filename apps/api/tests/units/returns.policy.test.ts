import { describe, expect, test } from "bun:test";
import {
  calculateSettlement,
  overdueAmount,
  refundDueDate,
  refundSummary,
  reviewInspection,
} from "../../src/modules/returns/returns.policy";

describe("confirmed return policies", () => {
  test("overdue uses local calendar day of actual return, with exact half-up VND rounding", () => {
    const expiry = new Date("2032-02-01T03:00:00Z");
    expect(
      overdueAmount("102.00", 25, expiry, new Date("2032-02-01T16:59:59.999Z"), "Asia/Ho_Chi_Minh"),
    ).toBe("0");
    expect(
      overdueAmount("102.00", 25, expiry, new Date("2032-02-01T17:00:00Z"), "Asia/Ho_Chi_Minh"),
    ).toBe("26");
    expect(
      overdueAmount("999999999999.00", 100, expiry, new Date("2032-02-02"), "Asia/Ho_Chi_Minh"),
    ).toBe("999999999999");
    expect(overdueAmount("1000", 0, expiry, new Date("2032-02-02"), "Asia/Ho_Chi_Minh")).toBe("0");
    expect(() => overdueAmount("1.50", 25, expiry, expiry, "Asia/Ho_Chi_Minh")).toThrow();
  });
  test("SLA begins after FM approval and skips weekends and configured holidays", () => {
    // Friday 2032-01-02 local; Monday is a configured holiday.
    expect(
      refundDueDate(new Date("2032-01-02T03:00:00Z"), "Asia/Ho_Chi_Minh", ["2032-01-05"]),
    ).toBe("2032-01-08");
    expect(refundDueDate(new Date("2032-01-02T03:00:00Z"), "Asia/Ho_Chi_Minh", [])).toBe(
      "2032-01-07",
    );
  });
  test("admin severity snapshot determines FAIL; remaining property alone does not", () => {
    const definition = [
      { code: "PROPERTY", label: "Property", group: "REMAINING_PROPERTY" as const, serious: true },
      { code: "UNIT", label: "Unit", group: "UNIT_CONDITION" as const, serious: true },
      { code: "HYGIENE", label: "Hygiene", group: "HYGIENE_SAFETY" as const, serious: false },
      { code: "EVIDENCE", label: "Evidence", group: "EVIDENCE" as const, serious: false },
    ];
    const photo = "12000000-0000-4000-8000-000000000001";
    const results = definition.map((item) => ({
      code: item.code,
      issue: false,
      note: "",
      photoIds: [] as string[],
    }));
    expect(reviewInspection(definition, results, [])).toBe("PASS");
    const property = results.map((r) =>
      r.code === "PROPERTY" ? { ...r, issue: true, note: "Left item", photoIds: [photo] } : r,
    );
    expect(reviewInspection(definition, property, [photo])).toBe("PASS");
    const minor = results.map((r) =>
      r.code === "HYGIENE" ? { ...r, issue: true, note: "Minor issue", photoIds: [photo] } : r,
    );
    expect(reviewInspection(definition, minor, [photo])).toBe("PASS");
    const serious = results.map((r) =>
      r.code === "UNIT" ? { ...r, issue: true, note: "Damage", photoIds: [photo] } : r,
    );
    expect(reviewInspection(definition, serious, [photo])).toBe("FAIL");
    expect(() => reviewInspection(definition, serious, [])).toThrow();
    expect(() => reviewInspection(definition, results.slice(1), [])).toThrow();
    expect(() => reviewInspection(definition, [results[0], ...results.slice(0, 3)], [])).toThrow();
  });
});

describe("return financial calculations", () => {
  const settlement = {
    id: "revision-1",
    depositSnapshot: "100",
    overdueFeeAmount: "0",
    damageAmount: "0",
    unusedRentRefundAmount: "100",
    refundEntitlement: "200",
  };
  test("correction keeps source payments immutable and enforces aggregate entitlement", () => {
    const refunds = [
      {
        settlementId: settlement.id,
        amount: "100",
        depositRefundAmount: "100",
        rentRefundAmount: "0",
      },
    ];
    expect(
      refundSummary(
        { ...settlement, damageAmount: "50", refundEntitlement: "150" },
        [settlement],
        refunds,
      ),
    ).toEqual({
      refundEntitlement: "150",
      remainingRefund: "50",
      allocationKnown: true,
      remainingDepositRefund: "0",
      remainingRentRefund: "100",
      confirmedDepositRefund: "100",
      confirmedRentRefund: "0",
    });
    expect(
      refundSummary(
        settlement,
        [settlement],
        [
          {
            ...refunds[0],
            settlementId: settlement.id,
            amount: "100",
            depositRefundAmount: null,
            rentRefundAmount: null,
          },
        ],
      ).allocationKnown,
    ).toBe(false);
    expect(
      refundSummary(
        settlement,
        [settlement],
        [
          {
            settlementId: settlement.id,
            amount: "200",
            depositRefundAmount: null,
            rentRefundAmount: null,
          },
        ],
      ).confirmedRentRefund,
    ).toBe("100");
  });
  test("fees beyond deposit and overpaid corrections create debt without negative refund", () => {
    const input = {
      depositSnapshot: "100.00",
      rateSnapshot: 25,
      expectedEndAt: new Date("2032-01-01"),
      actualReturnAt: new Date("2032-01-02"),
      timezone: "Asia/Ho_Chi_Minh",
      damageAmount: "100",
      unusedRentRefundAmount: "10",
      paid: 40n,
    };
    expect(calculateSettlement(input)).toEqual({
      depositSnapshot: "100",
      rateSnapshot: 25,
      overdueFeeAmount: "25",
      damageAmount: "100",
      unusedRentRefundAmount: "10",
      refundEntitlement: "10",
      debtAmount: "55",
    });
  });
});
