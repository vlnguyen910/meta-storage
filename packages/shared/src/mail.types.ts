export interface BookingConfirmationEmailInput {
  deliveryId: string;
  trackingUrl: string;
  recipientEmail: string;
  bookingCode: string | null;
  facilityName: string;
  unitTypeName: string;
  qrUrl: string;
}
