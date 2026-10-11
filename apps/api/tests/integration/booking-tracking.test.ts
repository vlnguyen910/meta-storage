import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  bookingConfirmationEmails,
  bookings,
  checkInSlots,
  db,
  eq,
  facilities,
  facilityUnitTypes,
  inArray,
  payments,
  unitTypes,
} from "@metastorage/database";
import { BOOKING_ACCESS } from "@metastorage/shared/booking-access";
import { decryptMailPayload } from "@metastorage/shared/mail";
import Fastify from "fastify";
import { validatorCompiler } from "fastify-type-provider-zod";
import { sendPendingBookingConfirmations } from "../../../worker/src/mail/mail.job";
import type { MailMessage } from "../../../worker/src/mail/mail.types";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { redisPlugin } from "../../src/common/redis/plugin";
import { BookingEmailRepository } from "../../src/modules/bookings/booking-email.repository";
import { BookingEmailService } from "../../src/modules/bookings/booking-email.service";
import { bookingsRoutes } from "../../src/modules/bookings/bookings.routes";

const databaseUrl = process.env.BOOKING_TEST_DATABASE_URL;
const redisUrl = process.env.REDIS_TEST_URL;
const origin = "http://localhost:3000";
const id = randomUUID();
const ids = {
  facility: randomUUID(),
  type: randomUUID(),
  slot: randomUUID(),
  booking: randomUUID(),
  draft: randomUUID(),
};
const code = `TEST-${id}`;
const app = Fastify();
const keys: string[] = [];
const requestIp = `2001:db8:${randomBytes(2).toString("hex")}:${randomBytes(2).toString("hex")}::1`;
let created = false;
const mailSecret = "test-only-magic-link-secret-32-characters";
const prepareMail = () =>
  new BookingEmailService(new BookingEmailRepository(db), app.redis, {
    publicAppUrl: origin,
    magicLinkSecret: mailSecret,
    qrTokenSecret: "test-qr-secret",
  }).preparePendingConfirmations();
const trackingUrl = (message: MailMessage) => {
  const url = message.text.match(/https?:\/\/\S+/)?.[0];
  if (!url) throw new Error("Missing tracking URL");
  return url;
};

async function grant(
  bookingId = ids.booking,
  expiresAt = new Date(Date.now() + 60_000).toISOString(),
) {
  const token = randomBytes(32).toString("hex");
  const key = `booking:magic:${createHash("sha256").update(token).digest("hex")}`;
  keys.push(key);
  await app.redis.set(
    key,
    JSON.stringify({ bookingId, createdAt: new Date().toISOString(), expiresAt }),
    "EX",
    60,
  );
  return token;
}

async function exchange(token: string, requestOrigin = origin, remoteAddress = requestIp) {
  return app.inject({
    method: "POST",
    url: "/api/booking/magic-link/exchange",
    headers: { origin: requestOrigin },
    payload: { token },
    remoteAddress,
  });
}

describe.skipIf(!databaseUrl || !redisUrl)("Guest booking magic-link tracking", () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== databaseUrl)
      throw new Error("Use an isolated BOOKING_TEST_DATABASE_URL");
    await db.transaction(async (tx) => {
      await tx
        .insert(facilities)
        .values({ id: ids.facility, code: id, name: "Tracking facility", address: "Test address" });
      await tx.insert(unitTypes).values({
        id: ids.type,
        code: id,
        name: "Tracking unit",
        sizeLabel: "2 m²",
        lengthM: 1,
        widthM: 2,
        heightM: 2,
        monthlyPrice: 900000,
      });
      await tx.insert(facilityUnitTypes).values({ facilityId: ids.facility, unitTypeId: ids.type });
      await tx
        .insert(checkInSlots)
        .values({ id: ids.slot, name: "Tracking slot", startTime: "09:00", endTime: "10:30" });
      for (const [bookingId, status] of [
        [ids.booking, "CONFIRMED"],
        [ids.draft, "DRAFT"],
      ] as const) {
        await tx.insert(bookings).values({
          id: bookingId,
          bookingCode: bookingId === ids.booking ? code : `D-${id}`,
          status,
          contactName: "Guest contact",
          contactEmail: "guest@example.test",
          contactPhone: "0900000000",
          facilityId: ids.facility,
          unitTypeId: ids.type,
          checkInDate: "2031-02-01",
          checkInSlotId: ids.slot,
          rentalEndAt: new Date("2031-04-01T02:00:00Z"),
          requestedMonths: 2,
          monthlyRateSnapshot: "900000",
          rentalFeeAmount: "1800000",
          depositAmount: "900000",
          totalAmount: "2700000",
        });
      }
      await tx.insert(payments).values({
        bookingId: ids.booking,
        holdTokenHash: id,
        provider: "test",
        providerPaymentId: id,
        paymentCode: id.slice(0, 32),
        idempotencyKey: id,
        totalAmount: "2700000",
        currency: "VND",
        status: "SUCCEEDED",
        paidAt: new Date("2031-01-01T00:00:00Z"),
      });
    });
    created = true;
    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    setupErrorHandler(app);
    await app.register(redisPlugin, { url: redisUrl });
    await app.register(bookingsRoutes, { prefix: "/api" });
    await app.ready();
  });

  afterAll(async () => {
    if (app.hasDecorator("redis") && keys.length) await app.redis.del(...keys);
    await app.close();
    if (!created) return;
    await db.delete(payments).where(eq(payments.bookingId, ids.booking));
    await db.delete(bookings).where(inArray(bookings.id, [ids.booking, ids.draft]));
    await db.delete(checkInSlots).where(eq(checkInSlots.id, ids.slot));
    await db.delete(facilityUnitTypes).where(eq(facilityUnitTypes.facilityId, ids.facility));
    await db.delete(unitTypes).where(eq(unitTypes.id, ids.type));
    await db.delete(facilities).where(eq(facilities.id, ids.facility));
  });

  test("magic link grants a scoped HttpOnly session, with live customer data and no secrets", async () => {
    const token = await grant();
    const response = await exchange(token);
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).not.toContain(token);
    const cookie = response.cookies[0];
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    const cookieHeader = `${cookie?.name}=${cookie?.value}`;
    const sessionKey = `booking:session:${createHash("sha256")
      .update(cookie?.value ?? "")
      .digest("hex")}`;
    keys.push(sessionKey);
    expect(await app.redis.ttl(sessionKey)).toBeGreaterThan(1700);
    expect(response.json().data).toEqual({
      bookingCode: code,
      expiresAt: expect.any(String),
      booking: expect.objectContaining({
        bookingCode: code,
        status: "CONFIRMED",
        contact: { fullName: "Guest contact", email: "guest@example.test", phone: "0900000000" },
        payment: { status: "SUCCEEDED", paidAt: "2031-01-01T00:00:00.000Z" },
      }),
    });
    expect(response.body).not.toMatch(
      /qrToken|userId|assignedStaff|providerPaymentId|accessTokenHash/,
    );
    const tracked = await app.inject({
      url: `/api/booking/tracking/${code}`,
      headers: { cookie: cookieHeader },
    });
    expect(tracked.statusCode).toBe(200);
    expect(response.json().data.booking).toEqual(tracked.json().data);
    expect(response.json().data.booking).toMatchObject({
      facility: { name: "Tracking facility", address: "Test address" },
      pricing: { totalAmount: "2700000.00" },
    });
    expect(
      (await app.inject({ url: "/api/booking/tracking/OTHER", headers: { cookie: cookieHeader } }))
        .statusCode,
    ).toBe(404);
    await db.update(bookings).set({ status: "CANCELLED" }).where(eq(bookings.id, ids.booking));
    expect(
      (
        await app.inject({
          url: `/api/booking/tracking/${code}`,
          headers: { cookie: cookieHeader },
        })
      ).json().data.status,
    ).toBe("CANCELLED");
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/booking/session/revoke",
          headers: { cookie: cookieHeader, origin },
        })
      ).statusCode,
    ).toBe(204);
    expect(await app.redis.exists(sessionKey)).toBe(0);
    expect(
      (
        await app.inject({
          url: `/api/booking/tracking/${code}`,
          headers: { cookie: cookieHeader },
        })
      ).statusCode,
    ).toBe(401);
    // The reusable link can create another session after revocation.
    const reopened = await exchange(token);
    expect(reopened.statusCode).toBe(200);
    keys.push(
      `booking:session:${createHash("sha256")
        .update(reopened.cookies[0]?.value ?? "")
        .digest("hex")}`,
    );
    await db.update(bookings).set({ status: "CONFIRMED" }).where(eq(bookings.id, ids.booking));
  });

  test("confirmation worker retries the same link and grants access without a login", async () => {
    const deliveryId = randomUUID();
    const confirmedAt = new Date(Date.now() - 3600_000);
    await db.insert(bookingConfirmationEmails).values({
      id: deliveryId,
      bookingId: ids.booking,
      recipientEmail: "guest@example.test",
      template: "booking-confirmation",
      createdAt: confirmedAt,
    });
    await prepareMail();
    const delivered: MailMessage[] = [];
    let fail = true;
    const dependencies = {
      db,
      redis: app.redis,
      mailPayloadSecret: mailSecret,
      mailAdapter: {
        send: async (input: MailMessage) => {
          delivered.push(input);
          if (fail) throw new Error("provider-secret-should-not-be-persisted");
          return { providerMessageId: "test-provider-id" };
        },
      },
    };
    await sendPendingBookingConfirmations(dependencies);
    const [pending] = await db
      .select()
      .from(bookingConfirmationEmails)
      .where(eq(bookingConfirmationEmails.id, deliveryId));
    expect(pending?.status).toBe("PENDING");
    expect(pending?.attempts).toBe(1);
    expect(pending?.lastError).not.toContain("provider-secret");
    expect(pending?.expiresAt).toEqual(
      new Date(confirmedAt.getTime() + BOOKING_ACCESS.magicTtl * 1000),
    );
    fail = false;
    await Promise.all([
      sendPendingBookingConfirmations(dependencies),
      sendPendingBookingConfirmations(dependencies),
    ]);
    expect(delivered).toHaveLength(2);
    expect(delivered[1]?.text).toBe(delivered[0]?.text);
    const [sent] = await db
      .select()
      .from(bookingConfirmationEmails)
      .where(eq(bookingConfirmationEmails.id, deliveryId));
    expect(sent?.status).toBe("SENT");
    expect(sent?.attempts).toBe(2);
    const firstDelivery = delivered[0];
    if (!firstDelivery) throw new Error("Missing delivery");
    expect(sent?.payload).not.toContain(trackingUrl(firstDelivery));
    const token = new URL(trackingUrl(firstDelivery)).hash.slice("#token=".length);
    keys.push(
      `booking:delivery:${deliveryId}`,
      `booking:magic:${createHash("sha256").update(token).digest("hex")}`,
    );
    const response = await exchange(token);
    expect(response.statusCode).toBe(200);
    const cookie = response.cookies[0];
    if (!cookie) throw new Error("Missing tracking cookie");
    const sessionKey = `booking:session:${createHash("sha256").update(cookie.value).digest("hex")}`;
    keys.push(sessionKey);
    // Redis disappearance/expiry revokes access even if the browser retains a cookie.
    await app.redis.del(sessionKey);
    expect(
      (
        await app.inject({
          url: `/api/booking/tracking/${code}`,
          headers: { cookie: `${cookie.name}=${cookie.value}` },
        })
      ).statusCode,
    ).toBe(401);
    await db.delete(bookingConfirmationEmails).where(eq(bookingConfirmationEmails.id, deliveryId));
  });

  test("Redis preparation failure preserves the request; recovery prepares it without changing its deadline", async () => {
    const deliveryId = randomUUID();
    const confirmedAt = new Date(Date.now() - 3600_000);
    await db.insert(bookingConfirmationEmails).values({
      id: deliveryId,
      bookingId: ids.booking,
      recipientEmail: "guest@example.test",
      template: "recovery-test",
      createdAt: confirmedAt,
    });
    const get = spyOn(app.redis, "get").mockRejectedValueOnce(new Error("private-redis-command"));
    try {
      await prepareMail();
      const [pending] = await db
        .select()
        .from(bookingConfirmationEmails)
        .where(eq(bookingConfirmationEmails.id, deliveryId));
      expect(pending).toMatchObject({ status: "PENDING", attempts: 0, payload: null });
      expect(pending?.lastError).not.toContain("private-redis-command");
    } finally {
      get.mockRestore();
    }
    try {
      await prepareMail();
      const [ready] = await db
        .select()
        .from(bookingConfirmationEmails)
        .where(eq(bookingConfirmationEmails.id, deliveryId));
      expect(ready?.payload).toBeTruthy();
      expect(ready?.expiresAt).toEqual(
        new Date(confirmedAt.getTime() + BOOKING_ACCESS.magicTtl * 1000),
      );
      const payload = JSON.parse(decryptMailPayload(ready?.payload ?? "", mailSecret, deliveryId));
      const token = new URL(payload.trackingUrl).hash.slice("#token=".length);
      keys.push(
        `booking:delivery:${deliveryId}`,
        `booking:magic:${createHash("sha256").update(token).digest("hex")}`,
      );
    } finally {
      await db
        .delete(bookingConfirmationEmails)
        .where(eq(bookingConfirmationEmails.id, deliveryId));
    }
  });

  test("expired requests become FAILED before preparation or delivery, without sending mail", async () => {
    const unpreparedId = randomUUID();
    const preparedId = randomUUID();
    await db.insert(bookingConfirmationEmails).values([
      {
        id: unpreparedId,
        bookingId: ids.booking,
        recipientEmail: "guest@example.test",
        template: "expired-unprepared",
        createdAt: new Date(Date.now() - 8 * 86400_000),
      },
      {
        id: preparedId,
        bookingId: ids.booking,
        recipientEmail: "guest@example.test",
        template: "expired-prepared",
        payload: "not-decrypted-because-expired",
        expiresAt: new Date(Date.now() - 1000),
      },
    ]);
    let sent = 0;
    try {
      await prepareMail();
      await sendPendingBookingConfirmations({
        db,
        redis: app.redis,
        mailPayloadSecret: mailSecret,
        mailAdapter: {
          send: async () => {
            sent++;
            return { providerMessageId: "unexpected" };
          },
        },
      });
      const rows = await db
        .select()
        .from(bookingConfirmationEmails)
        .where(inArray(bookingConfirmationEmails.id, [unpreparedId, preparedId]));
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.status === "FAILED" && row.attempts === 0)).toBe(true);
      expect(sent).toBe(0);
    } finally {
      await db
        .delete(bookingConfirmationEmails)
        .where(inArray(bookingConfirmationEmails.id, [unpreparedId, preparedId]));
    }
  });

  test("marks the fifth failed email attempt terminal without changing the booking", async () => {
    const deliveryId = randomUUID();
    await db.insert(bookingConfirmationEmails).values({
      id: deliveryId,
      bookingId: ids.booking,
      recipientEmail: "guest@example.test",
      template: "terminal-test",
      attempts: 4,
    });
    await prepareMail();
    try {
      await sendPendingBookingConfirmations({
        db,
        redis: app.redis,
        mailPayloadSecret: mailSecret,
        mailAdapter: {
          send: async (input: MailMessage) => {
            const token = new URL(trackingUrl(input)).hash.slice("#token=".length);
            keys.push(
              `booking:delivery:${deliveryId}`,
              `booking:magic:${createHash("sha256").update(token).digest("hex")}`,
            );
            throw new Error("private-provider-error");
          },
        },
      });
      const [email] = await db
        .select()
        .from(bookingConfirmationEmails)
        .where(eq(bookingConfirmationEmails.id, deliveryId));
      expect(email?.status).toBe("FAILED");
      expect(email?.attempts).toBe(5);
      const [booking] = await db
        .select({ status: bookings.status })
        .from(bookings)
        .where(eq(bookings.id, ids.booking));
      expect(booking?.status).toBe("CONFIRMED");
    } finally {
      await db
        .delete(bookingConfirmationEmails)
        .where(eq(bookingConfirmationEmails.id, deliveryId));
    }
  });

  test("fails closed when Redis is unavailable, without leaking command data", async () => {
    const redisGet = spyOn(app.redisService, "get").mockImplementationOnce(async () => {
      throw new Error("private-redis-command-data");
    });
    try {
      const response = await app.inject({
        url: `/api/booking/tracking/${code}`,
        headers: { cookie: `metastorage_booking_session=${"c".repeat(64)}` },
      });
      expect(response.statusCode).toBe(503);
      expect(response.body).not.toContain("private-redis-command-data");
      expect(response.headers["cache-control"]).toBe("no-store");
    } finally {
      redisGet.mockRestore();
    }
  });

  test("rejects missing, expired, unknown, malformed and draft access", async () => {
    expect((await app.inject(`/api/booking/tracking/${code}`)).statusCode).toBe(401);
    expect((await exchange("a".repeat(64))).statusCode).toBe(401);
    expect((await exchange(await grant(ids.booking, new Date(0).toISOString()))).statusCode).toBe(
      401,
    );
    expect((await exchange(await grant(ids.draft))).statusCode).toBe(401);
    expect((await exchange("not-a-token")).statusCode).toBe(400);
  });

  test("rejects cross-origin mutations and limits invalid token attempts atomically", async () => {
    expect((await exchange(await grant(), "https://attacker.example")).statusCode).toBe(403);
    const ip = `2001:db8:${randomBytes(2).toString("hex")}:${randomBytes(2).toString("hex")}::2`;
    const responses = await Promise.all(
      Array.from({ length: 31 }, () => exchange("b".repeat(64), origin, ip)),
    );
    expect(responses.filter((response) => response.statusCode === 401)).toHaveLength(30);
    expect(responses.filter((response) => response.statusCode === 429)).toHaveLength(1);
  });
});
