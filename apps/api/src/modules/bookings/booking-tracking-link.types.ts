export interface BookingTrackingLinkInput {
  deliveryId: string;
  bookingId: string;
  secret: string;
  publicAppUrl: string;
  confirmedAt: Date;
}
export interface EncryptedBookingDelivery {
  ciphertext: string;
  iv: string;
  tag: string;
  bookingId: string;
  createdAt: string;
  expiresAt: string;
}
