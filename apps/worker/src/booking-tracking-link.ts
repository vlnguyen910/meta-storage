import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import {
  BOOKING_ACCESS,
  bookingDeliveryKey,
  bookingMagicKey,
} from "@metastorage/shared/booking-access";
import type Redis from "ioredis";
import { BOOKING_EMAIL_MESSAGES } from "./booking-email.messages";
import type {
  BookingTrackingLinkInput,
  EncryptedBookingDelivery,
} from "./booking-tracking-link.types";

export async function createBookingTrackingLink(
  redis: Redis,
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
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + BOOKING_ACCESS.magicTtl * 1000).toISOString(),
    };
    // Return the winner atomically. A retry can recover after a crash before grant creation.
    raw = String(
      await redis.eval(
        "if redis.call('EXISTS', KEYS[1]) == 0 then redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2]); end; return redis.call('GET', KEYS[1])",
        1,
        deliveryKey,
        JSON.stringify(delivery),
        BOOKING_ACCESS.magicTtl,
      ),
    );
  }
  const delivery = JSON.parse(raw) as EncryptedBookingDelivery;
  const ttl = Math.floor((Date.parse(delivery.expiresAt) - Date.now()) / 1000);
  if (delivery.bookingId !== input.bookingId || ttl <= 0)
    throw new Error(BOOKING_EMAIL_MESSAGES.accessExpired);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(delivery.iv, "hex"));
  decipher.setAAD(Buffer.from(`${input.deliveryId}:${input.bookingId}`));
  decipher.setAuthTag(Buffer.from(delivery.tag, "hex"));
  const token = Buffer.concat([
    decipher.update(Buffer.from(delivery.ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
  await redis.set(
    bookingMagicKey(token),
    JSON.stringify({
      bookingId: input.bookingId,
      createdAt: delivery.createdAt,
      expiresAt: delivery.expiresAt,
    }),
    "EX",
    ttl,
    "NX",
  );
  const url = new URL("/booking/tracking", appUrl);
  url.hash = `token=${token}`;
  return { trackingUrl: url.toString(), expiresAt: delivery.expiresAt };
}
