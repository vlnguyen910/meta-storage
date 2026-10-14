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
  currency: string;
  reference: string;
  refundedAt: string;
  refundedBy: string;
};
