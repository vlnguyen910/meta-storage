// Server-only entrypoint: never export crypto helpers through the browser entrypoint.
import { createHash } from "node:crypto";

export type { BookingAccessGrant, BookingAccessSession } from "./booking-access.types";
export const BOOKING_ACCESS = {
  magicTtl: 7 * 24 * 60 * 60,
  sessionTtl: 30 * 60,
  rateWindow: 60,
  rateLimit: 30,
} as const;
export const bookingAccessHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const bookingMagicKey = (token: string) => `booking:magic:${bookingAccessHash(token)}`;
export const bookingSessionKey = (token: string) => `booking:session:${bookingAccessHash(token)}`;
export const bookingDeliveryKey = (deliveryId: string) => `booking:delivery:${deliveryId}`;
