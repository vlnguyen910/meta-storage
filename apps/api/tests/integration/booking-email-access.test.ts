import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  BOOKING_ACCESS,
  bookingDeliveryKey,
  bookingMagicKey,
} from "@metastorage/shared/booking-access";
import Redis from "ioredis";
import { createBookingTrackingLink } from "../../../worker/src/booking-tracking-link";
import { ResendMailAdapter } from "../../../worker/src/resend-mail-adapter";

const redisUrl = process.env.REDIS_TEST_URL;
const redis = new Redis(redisUrl ?? "redis://127.0.0.1:6379/14", { lazyConnect: true });
const keys: string[] = [];
const input = {
  deliveryId: randomUUID(),
  bookingId: randomUUID(),
  secret: "test-only-secret-with-at-least-32-characters",
  publicAppUrl: "http://localhost:3000",
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
    expect(await redis.ttl(bookingMagicKey(token))).toBeGreaterThan(BOOKING_ACCESS.magicTtl - 10);
    expect(JSON.parse((await redis.get(bookingMagicKey(token))) ?? "null")).toMatchObject({
      bookingId: input.bookingId,
      expiresAt: first.expiresAt,
    });
    await redis.expire(bookingMagicKey(token), 120);
    expect((await createBookingTrackingLink(redis, input)).trackingUrl).toBe(first.trackingUrl);
    expect(await redis.ttl(bookingMagicKey(token))).toBeLessThanOrEqual(120);
  });
  test("Resend sends the tracking URL, escapes HTML and uses a stable idempotency key", async () => {
    let sentBody: Record<string, unknown> = {};
    let sentHeaders: Headers | undefined;
    const adapter = new ResendMailAdapter({
      apiKey: "test-key",
      fromEmail: "StoreX <bookings@example.test>",
      fetcher: async (_url, options) => {
        sentBody = JSON.parse(options?.body as string);
        sentHeaders = new Headers(options?.headers);
        return new Response(JSON.stringify({ id: "provider-message" }), { status: 200 });
      },
    });
    expect(
      await adapter.sendBookingConfirmation({
        deliveryId: input.deliveryId,
        recipientEmail: "guest@example.test",
        bookingCode: "SX123",
        facilityName: "<script>bad</script>",
        unitTypeName: "Small",
        qrUrl: "https://example.test/check-in",
        trackingUrl: "https://example.test/booking/tracking#token=secret",
      }),
    ).toEqual({ providerMessageId: "provider-message" });
    expect(sentHeaders?.get("Idempotency-Key")).toBe(`booking-confirmation/${input.deliveryId}`);
    expect(sentBody.html).toContain("booking/tracking#token=secret");
    expect(sentBody.html).not.toContain("<script>");
    const failing = new ResendMailAdapter({
      apiKey: "test-key",
      fromEmail: "test@example.test",
      fetcher: async () => new Response("secret-provider-response", { status: 500 }),
    });
    await expect(
      failing.sendBookingConfirmation({
        deliveryId: input.deliveryId,
        recipientEmail: "guest@example.test",
        bookingCode: "SX123",
        facilityName: "Facility",
        unitTypeName: "Small",
        qrUrl: "https://example.test",
        trackingUrl: "https://example.test",
      }),
    ).rejects.not.toThrow("secret-provider-response");
  });
});
