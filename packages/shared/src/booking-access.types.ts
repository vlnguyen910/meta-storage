export interface BookingAccessGrant {
  bookingId: string;
  createdAt: string;
  expiresAt: string;
}
export interface BookingAccessSession extends BookingAccessGrant {
  bookingCode: string;
}
