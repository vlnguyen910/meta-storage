import type { BookingConfirmation } from "./bookings";
import type { PaymentStatus, SepayPaymentInstructions } from "./payments";

export type BookingPaymentSession = {
  bookingId: string;
  paymentId: string;
  status: "PENDING";
  provider: "sepay";
  paymentCode: string;
  checkoutUrl: string;
  checkoutFormFields: Record<string, string | number>;
  expiresAt: string;
};

export type ManualRefund = {
  paymentId: string;
  bookingId: string | null;
  amount: string;
  depositForfeitedAmount: string;
  currency: string;
  reason: string | null;
  paidAt: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

export type ManualRefundConfirmation = {
  paymentId: string;
  status: "REFUNDED";
  amount: string;
  depositForfeitedAmount: string;
  currency: string;
  reference: string;
  refundedAt: string;
  refundedBy: string;
};

export type PaymentStatusResponse = {
  paymentId: string;
  status: PaymentStatus;
  provider: string;
  paymentCode: string;
  transferInstructions?: SepayPaymentInstructions;
  checkoutUrl?: string;
  checkoutFormFields?: Record<string, string | number>;
  confirmation?: BookingConfirmation;
  refund?: {
    amount: string;
    depositForfeitedAmount: string;
    reason: string | null;
  };
};
