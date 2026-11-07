// Server-only entrypoint: never export crypto helpers through the browser entrypoint.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type { BookingAccessGrant, BookingAccessSession } from "./booking-access.types";
export const BOOKING_ACCESS = {
  magicTtl: 24 * 60 * 60,
  sessionTtl: 30 * 60,
  rateWindow: 60,
  rateLimit: 30,
  resendRateWindow: 60 * 60,
  resendPerBookingLimit: 3,
  resendPerIpLimit: 10,
} as const;
export const bookingAccessHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const bookingMagicKey = (token: string) => `booking:magic:${bookingAccessHash(token)}`;
export const bookingActiveMagicKey = (bookingId: string) => `booking:magic:active:${bookingId}`;
export const bookingSessionKey = (token: string) => `booking:session:${bookingAccessHash(token)}`;
export const bookingDeliveryKey = (deliveryId: string) => `booking:delivery:${deliveryId}`;

import type {
  BookingDeliveryRedis,
  BookingTrackingLinkInput,
  EncryptedBookingDelivery,
} from "./booking-access.types";
import { BOOKING_EMAIL_MESSAGES } from "./mail.messages";

export async function createBookingTrackingLink(
  redis: BookingDeliveryRedis,
  input: BookingTrackingLinkInput,
): Promise<{ trackingUrl: string; expiresAt: string }> {
  if (input.secret.length < 32) throw new Error(BOOKING_EMAIL_MESSAGES.accessConfiguration);
  const appUrl = new URL(input.publicAppUrl);
  if (!["http:", "https:"].includes(appUrl.protocol) || appUrl.username || appUrl.password)
    throw new Error(BOOKING_EMAIL_MESSAGES.accessConfiguration);
  const encryptionKey = createHash("sha256").update(input.secret).digest();
  const deliveryKey = bookingDeliveryKey(input.deliveryId);
  let raw = await redis.get(deliveryKey);
  if (!raw) {
    const token = randomBytes(32).toString("hex");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
    cipher.setAAD(Buffer.from(`${input.deliveryId}:${input.bookingId}`));
    const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    const delivery: EncryptedBookingDelivery = {
      ciphertext: ciphertext.toString("hex"),
      iv: iv.toString("hex"),
      tag: cipher.getAuthTag().toString("hex"),
      bookingId: input.bookingId,
      createdAt: input.confirmedAt.toISOString(),
      expiresAt: new Date(
        input.confirmedAt.getTime() + BOOKING_ACCESS.magicTtl * 1000,
      ).toISOString(),
    };
    // Return the winner atomically. A retry can recover after a crash before grant creation.
    raw = String(
      await redis.eval(
        "if redis.call('EXISTS', KEYS[1]) == 0 then redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2]); end; return redis.call('GET', KEYS[1])",
        1,
        deliveryKey,
        JSON.stringify(delivery),
        Math.max(
          1,
          Math.ceil(
            (input.confirmedAt.getTime() + BOOKING_ACCESS.magicTtl * 1000 - Date.now()) / 1000,
          ),
        ),
      ),
    );
  }
  const delivery = JSON.parse(raw) as EncryptedBookingDelivery;
  const expiresAt = new Date(
    Math.min(
      Date.parse(delivery.expiresAt),
      Date.parse(delivery.createdAt) + BOOKING_ACCESS.magicTtl * 1000,
    ),
  ).toISOString();
  const ttl = Math.floor((Date.parse(expiresAt) - Date.now()) / 1000);
  if (delivery.bookingId !== input.bookingId || ttl <= 0)
    throw new Error(BOOKING_EMAIL_MESSAGES.accessExpired);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(delivery.iv, "hex"));
  decipher.setAAD(Buffer.from(`${input.deliveryId}:${input.bookingId}`));
  decipher.setAuthTag(Buffer.from(delivery.tag, "hex"));
  const token = Buffer.concat([
    decipher.update(Buffer.from(delivery.ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
  const grantKey = bookingMagicKey(token);
  const activeKey = bookingActiveMagicKey(input.bookingId);
  const script = input.replaceExisting
    ? "local previous = redis.call('GET', KEYS[1]); if previous and previous ~= KEYS[2] then redis.call('DEL', previous); end; redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2]); redis.call('SET', KEYS[1], KEYS[2], 'EX', ARGV[2]); return 1"
    : "local active = redis.call('GET', KEYS[1]); if active and active ~= KEYS[2] then return 0; end; redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2], 'NX'); if not active then redis.call('SET', KEYS[1], KEYS[2], 'EX', ARGV[2]); end; return 1";
  const stored = await redis.eval(
    script,
    2,
    activeKey,
    grantKey,
    JSON.stringify({
      bookingId: input.bookingId,
      createdAt: delivery.createdAt,
      expiresAt,
    }),
    ttl,
  );
  if (Number(stored) !== 1) throw new Error(BOOKING_EMAIL_MESSAGES.accessExpired);
  const url = new URL("/booking/tracking", appUrl);
  url.hash = `token=${token}`;
  return { trackingUrl: url.toString(), expiresAt };
}
