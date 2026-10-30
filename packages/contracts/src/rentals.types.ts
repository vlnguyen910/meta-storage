import type { PaymentStatus, PaymentType } from "./payments";
import type { RentalListItem } from "./rentals";

export interface RentalPageCursor {
  afterEndAt: string;
  afterId: string;
}

export interface RentalPage {
  items: RentalListItem[];
  nextCursor: RentalPageCursor | null;
}

export interface RentalRenewalDto {
  id: string;
  rentalId: string;
  status: "QUOTED" | "PENDING_PAYMENT" | "APPLIED" | "REFUND_REQUIRED" | "EXPIRED";
  months: number;
  oldEndAt: string;
  newEndAt: string;
  monthlyRateSnapshot: string;
  amount: string;
  currency: "VND";
  cutoffAt: string;
  expiresAt: string;
  createdAt: string;
  appliedAt: string | null;
  failureReason: string | null;
  paymentId: string | null;
}

export interface RentalRenewalPage {
  items: RentalRenewalDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface RentalRenewalPaymentSession {
  renewalId: string;
  paymentId: string;
  provider: "sepay";
  status: "PENDING";
  paymentCode: string;
  checkoutUrl: string;
  checkoutFormFields: Record<string, string | number>;
  expiresAt: string;
}

/** Booking payments associated with a rental. */
export interface RentalPaymentItem {
  id: string;
  type: PaymentType;
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
}

export interface FacilityRentalItem {
  id: string;
  bookingId: string | null;
  reservationId?: string | null;
  userId: string;
  bookingCode: string | null;
  facilityId: string;
  status: string;
  customer: {
    userId: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  unit: { id: string; code: string; unitTypeId: string; unitTypeName: string; sizeLabel: string };
  startAt: string;
  endAt: string;
  closedAt: string | null;
}

export interface FacilityRentalPage {
  items: FacilityRentalItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface FacilityRentalPaymentItem {
  id: string;
  type: PaymentType;
  paymentCode: string | null;
  status: PaymentStatus;
  amount: string;
  currency: string;
  paidAt: string | null;
  refundAmount: string | null;
  refundReason: string | null;
  refundedAt: string | null;
  createdAt: string;
}

export interface FacilityRentalPaymentPage {
  items: FacilityRentalPaymentItem[];
  total: number;
  limit: number;
  offset: number;
}
