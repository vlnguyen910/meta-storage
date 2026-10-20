export interface BookingAccessGrant {
  bookingId: string;
  createdAt: string;
  expiresAt: string;
}
export interface BookingAccessSession extends BookingAccessGrant {
  bookingCode: string;
}

export interface BookingDeliveryRedis {
  get(key: string): Promise<string | null>;
  eval(script: string, numberOfKeys: number, ...args: (string | number)[]): Promise<unknown>;
  set(key: string, value: string, mode: "EX", ttl: number, condition: "NX"): Promise<unknown>;
}
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
