import type { PaymentStatus } from "./payments";
import type { RentalRenewalDto } from "./renewals.types";
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
  chargeId?: string | null;
  source?: "BOOKING" | "RENEWAL" | "EXTRA" | "RETURN_DEBT";
  id: string;
  paymentCode: string | null;
  provider: string | null;
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
  chargeRefunds?: RentalChargeRefundTransfer[];
}

export interface RentalReturnRefundItem {
  id: string;
  amount: string;
  reference: string;
  confirmedAt: string;
  settlementId: string;
}

export interface FacilityRentalItem {
  id: string;
  bookingId: string;
  bookingCode: string | null;
  facilityId: string;
  status: string;
  version: number;
  customer: {
    userId: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  unit: { id: string; code: string; unitTypeId: string; unitTypeName: string; sizeLabel: string };
  startAt: string;
  expectedEndAt: string;
  actualReturnAt: string | null;
  closedAt: string | null;
  abandonedReviewAt: string | null;
  depositAmount: string;
  initialPayment: {
    id: string;
    status: PaymentStatus;
    amount: string;
    currency: string;
    paidAt: string | null;
  } | null;
}

export interface FacilityRentalPage {
  items: FacilityRentalItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface FacilityRentalPaymentItem {
  id: string;
  paymentCode: string | null;
  chargeId: string | null;
  source: "BOOKING" | "EXTRA" | "RETURN_DEBT" | "RENEWAL";
  status: PaymentStatus;
  amount: string;
  currency: string;
  paidAt: string | null;
  refundAmount: string | null;
  refundReason: string | null;
  refundedAt: string | null;
  createdAt: string;
  confirmedRefunds: {
    id: string;
    source: "RETURN" | "CHARGE";
    amount: string;
    reference: string | null;
    confirmedAt: string;
  }[];
}

export interface FacilityRentalPaymentPage {
  items: FacilityRentalPaymentItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface FacilityRentalRenewalPage {
  items: RentalRenewalDto[];
  total: number;
  limit: number;
  offset: number;
}

export type RentalChargeRefundTransfer = {
  id: string;
  amount: string;
  reference: string | null;
  confirmedAt: string;
};
