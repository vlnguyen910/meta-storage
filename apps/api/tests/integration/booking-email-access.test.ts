import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  BOOKING_ACCESS,
  bookingDeliveryKey,
  bookingMagicKey,
} from "@metastorage/shared/booking-access";
import Redis from "ioredis";
import { createBookingTrackingLink } from "../../src/modules/bookings/bookings.repository";

const redisUrl = process.env.REDIS_TEST_URL;
const redis = new Redis(redisUrl ?? "redis://127.0.0.1:6379/14", { lazyConnect: true });
const keys: string[] = [];
const input = {
  deliveryId: randomUUID(),
  bookingId: randomUUID(),
  secret: "test-only-secret-with-at-least-32-characters",
  publicAppUrl: "http://localhost:3000",
  confirmedAt: new Date(Date.now() - 60_000),
};
describe.skipIf(!redisUrl)("Booking email magic-link delivery", () => {
  beforeAll(() => redis.connect());
  afterAll(async () => {
    if (keys.length) await redis.del(...keys);
    redis.disconnect();
  });
  test("concurrent retries preserve the link, ciphertext and original expiry", async () => {
    keys.push(bookingDeliveryKey(input.deliveryId));
    const results = await Promise.all(
      Array.from({ length: 8 }, () => createBookingTrackingLink(redis, input)),
    );
    expect(new Set(results.map((r) => r.trackingUrl)).size).toBe(1);
    const first = results[0];
    if (!first) throw new Error("Missing generated link");
    const token = new URL(first.trackingUrl).hash.slice("#token=".length);
    keys.push(bookingMagicKey(token));
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const delivery = await redis.get(bookingDeliveryKey(input.deliveryId));
    expect(delivery).not.toContain(token);
    expect(await redis.ttl(bookingMagicKey(token))).toBeGreaterThan(BOOKING_ACCESS.magicTtl - 70);
    expect(await redis.ttl(bookingMagicKey(token))).toBeLessThanOrEqual(
      BOOKING_ACCESS.magicTtl - 60,
    );
    expect(first.expiresAt).toBe(
      new Date(input.confirmedAt.getTime() + BOOKING_ACCESS.magicTtl * 1000).toISOString(),
    );
    expect(JSON.parse((await redis.get(bookingMagicKey(token))) ?? "null")).toMatchObject({
      bookingId: input.bookingId,
      expiresAt: first.expiresAt,
    });
    await redis.expire(bookingMagicKey(token), 120);
    expect((await createBookingTrackingLink(redis, input)).trackingUrl).toBe(first.trackingUrl);
    expect(await redis.ttl(bookingMagicKey(token))).toBeLessThanOrEqual(120);
  });
});
