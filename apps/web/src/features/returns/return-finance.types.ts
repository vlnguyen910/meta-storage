import type { ConfirmReturnRefund } from "@metastorage/contracts";

export interface SettlementDraft {
  damageAmount: string;
  unusedRentRefundAmount: string;
  reason: string;
}
export interface RefundDraft {
  depositRefundAmount: string;
  rentRefundAmount: string;
  reference: string;
  confirmed: boolean;
}
export interface PendingRefundAttempt {
  payload: Omit<ConfirmReturnRefund, "expectedVersion">;
}
