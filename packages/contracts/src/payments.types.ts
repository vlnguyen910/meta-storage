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
