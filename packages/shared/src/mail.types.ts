export interface BookingConfirmationEmailInput {
  deliveryId: string;
  trackingUrl: string;
  recipientEmail: string;
  bookingCode: string | null;
  facilityName: string;
  unitTypeName: string;
  qrUrl: string;
}

export interface BookingTrackingLinkEmailInput {
  deliveryId: string;
  recipientEmail: string;
  bookingCode: string;
  trackingUrl: string;
  expiresAt: string;
}

export interface MailJobData {
  deliveryId: string;
  kind: "BOOKING_CONFIRMATION" | "BOOKING_TRACKING_LINK";
  payload: string;
  expiresAt: string;
}
