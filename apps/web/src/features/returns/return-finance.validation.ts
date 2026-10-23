import type { ReturnRefundSummaryDto } from "@metastorage/contracts";
import { readWholeVnd } from "./integration-utils";
import type { RefundDraft } from "./return-finance.types";

export function refundAmounts(draft: RefundDraft, summary: ReturnRefundSummaryDto | null) {
  if (!summary?.allocationKnown) return null;
  const deposit = readWholeVnd(draft.depositRefundAmount);
  const rent = readWholeVnd(draft.rentRefundAmount);
  const depositLeft =
    summary.remainingDepositRefund === null ? null : readWholeVnd(summary.remainingDepositRefund);
  const rentLeft =
    summary.remainingRentRefund === null ? null : readWholeVnd(summary.remainingRentRefund);
  const totalLeft = readWholeVnd(summary.remainingRefund);
  if (
    deposit === null ||
    rent === null ||
    depositLeft === null ||
    rentLeft === null ||
    totalLeft === null ||
    deposit > depositLeft ||
    rent > rentLeft ||
    deposit + rent <= 0n ||
    deposit + rent > totalLeft
  )
    return null;
  return {
    amount: (deposit + rent).toString(),
    depositRefundAmount: deposit.toString(),
    rentRefundAmount: rent.toString(),
  };
}
