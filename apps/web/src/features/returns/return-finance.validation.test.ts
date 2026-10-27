import { expect, it } from "vitest";
import { refundAmounts } from "./return-finance.validation";

const summary = {
  allocationKnown: true,
  refundEntitlement: "600000",
  remainingRefund: "600000",
  remainingDepositRefund: "500000",
  remainingRentRefund: "100000",
  confirmedDepositRefund: "0",
  confirmedRentRefund: "0",
};
it("validates each source independently of the valid total", () => {
  const values = {
    depositRefundAmount: "600000",
    rentRefundAmount: "0",
    reference: "test",
    confirmed: true,
  };
  expect(refundAmounts(values, summary)).toBeNull();
  expect(
    refundAmounts(
      { ...values, depositRefundAmount: "500000", rentRefundAmount: "100000" },
      summary,
    ),
  ).toEqual({ amount: "600000", depositRefundAmount: "500000", rentRefundAmount: "100000" });
});
it("never converts unknown or malformed money to a zero balance", () => {
  const values = {
    depositRefundAmount: "1",
    rentRefundAmount: "0",
    reference: "test",
    confirmed: true,
  };
  expect(
    refundAmounts(values, { ...summary, allocationKnown: false, remainingDepositRefund: null }),
  ).toBeNull();
  expect(refundAmounts({ ...values, rentRefundAmount: "1.5" }, summary)).toBeNull();
});
