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

/** Booking payments associated with a rental. */
export interface RentalPaymentItem {
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
