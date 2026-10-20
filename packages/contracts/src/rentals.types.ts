import type { PaymentStatus } from "./payments";
import type { RentalListItem } from "./rentals";

export interface RentalPageCursor {
  afterEndAt: string;
  afterId: string;
}

export interface RentalPage {
  items: RentalListItem[];
  nextCursor: RentalPageCursor | null;
}

/** Stored checkout/refund facts. Pending payments are not collected revenue. */
export interface RentalPaymentItem {
  id: string;
  paymentCode: string;
  provider: string;
  status: PaymentStatus;
  totalAmount: string;
  currency: string;
  paidAt: string | null;
  refundAmount: string | null;
  refundReason: string | null;
  refundedAt: string | null;
  createdAt: string;
  /** Completed return transfers; distinct from checkout cancellation refunds. */
  returnRefunds: RentalReturnRefundItem[];
}

export interface RentalReturnRefundItem {
  id: string;
  amount: string;
  reference: string;
  confirmedAt: string;
  settlementId: string;
}
