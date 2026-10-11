export interface BookingConfirmationEmailInput {
  deliveryId: string;
  trackingUrl: string;
  recipientEmail: string;
  bookingCode: string | null;
  facilityName: string;
  unitTypeName: string;
  qrUrl: string;
}

export interface MailJobData {
  deliveryId: string;
  kind: "BOOKING_CONFIRMATION";
  payload: string;
  expiresAt: string;
}
