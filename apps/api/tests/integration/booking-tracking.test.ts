import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import {
  bookingAccessAudit,
  bookings,
  checkInSlots,
  db,
  eq,
  facilities,
  inArray,
  notificationOutbox,
  payments,
  rentals,
  storageUnits,
  unitTypes,
} from "@metastorage/database";
import {
  BOOKING_ACCESS,
  bookingActiveMagicKey,
  bookingDeliveryKey,
  bookingMagicKey,
} from "@metastorage/shared/booking-access";
import {
  decryptMailPayload,
  type MailJobData,
  mailJobId,
  trackingLinkMailJobId,
} from "@metastorage/shared/mail";
import { Queue, Worker } from "bullmq";
import Fastify from "fastify";
import { validatorCompiler } from "fastify-type-provider-zod";
import Redis from "ioredis";
import { processMailJob } from "../../../worker/src/mail/mail.job";
import type { MailMessage } from "../../../worker/src/mail/mail.types";
import { BookingMailService } from "../../../worker/src/notifications/booking-mail.service";
import type { OutboxRepository } from "../../../worker/src/notifications/outbox.repository";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { redisPlugin } from "../../src/common/redis/plugin";
import { env } from "../../src/config/env";
import { trustedProxyCidrsSchema } from "../../src/config/env.schema";
import { bookingsRoutes } from "../../src/modules/bookings/bookings.routes";
import { createBookingsService } from "../../src/modules/bookings/bookings.service";
import { guestRentalAccessRoutes } from "../../src/modules/guest-rental-access/guest-rental-access.routes";
import { createTestUnitType, deleteTestUnitTypes } from "../fixtures/facility-catalog";

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
const code = `TEST-${id.toUpperCase()}`;
const app = Fastify({ trustProxy: trustedProxyCidrsSchema.parse("127.0.0.1") });
const keys: string[] = [];
const requestIp = `2001:db8:${randomBytes(2).toString("hex")}:${randomBytes(2).toString("hex")}::1`;
let created = false;
const mailSecret = "test-only-magic-link-secret-32-characters";
async function grant(
  bookingId = ids.booking,
  expiresAt = new Date(Date.now() + 60_000).toISOString(),
  createdAt = new Date().toISOString(),
) {
  const token = randomBytes(32).toString("hex");
  const key = `booking:magic:${createHash("sha256").update(token).digest("hex")}`;
  keys.push(key);
  const activeKey = bookingActiveMagicKey(bookingId);
  const previousKey = await app.redis.get(activeKey);
  if (previousKey) await app.redis.del(previousKey);
  await app.redis.set(key, JSON.stringify({ bookingId, createdAt, expiresAt }), "EX", 60);
  await app.redis.set(activeKey, key, "EX", 60);
  keys.push(activeKey);
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
      await createTestUnitType(tx, {
        facilityId: ids.facility,
        id: ids.type,
        code: id,
        name: "Tracking unit",
        sizeLabel: "2 m²",
        lengthM: 1,
        widthM: 2,
        heightM: 2,
        monthlyPrice: 900000,
      });

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
    await app.register(guestRentalAccessRoutes, { prefix: "/api" });
    await app.ready();
  });

  afterAll(async () => {
    if (app.hasDecorator("redis") && keys.length) await app.redis.del(...keys);
    await app.close();
    if (!created) return;
    await db.delete(notificationOutbox).where(eq(notificationOutbox.bookingId, ids.booking));
    await db.delete(bookingAccessAudit).where(eq(bookingAccessAudit.bookingId, ids.booking));
    await db.delete(payments).where(eq(payments.bookingId, ids.booking));
    await db.delete(bookings).where(inArray(bookings.id, [ids.booking, ids.draft]));
    await db.delete(checkInSlots).where(eq(checkInSlots.id, ids.slot));

    await deleteTestUnitTypes(db, eq(unitTypes.id, ids.type));
    await db.delete(facilities).where(eq(facilities.id, ids.facility));
  });

  test("tracking retains cancelled bookings while rent-only refund is pending", async () => {
    await db.update(bookings).set({ status: "CANCELLED" }).where(eq(bookings.id, ids.booking));
    await db
      .update(payments)
      .set({
        status: "REFUND_PENDING",
        refundReason: "CUSTOMER_CANCELLATION",
        refundAmount: "1800000",
        depositForfeitedAmount: "900000",
      })
      .where(eq(payments.bookingId, ids.booking));
    try {
      const response = await exchange(await grant());
      expect(response.statusCode).toBe(200);
      expect(response.json().data.booking).toMatchObject({
        status: "CANCELLED",
        payment: {
          status: "REFUND_PENDING",
          paidAt: "2031-01-01T00:00:00.000Z",
          refundAmount: "1800000.00",
          depositForfeitedAmount: "900000.00",
        },
      });
    } finally {
      await db.update(bookings).set({ status: "CONFIRMED" }).where(eq(bookings.id, ids.booking));
      await db
        .update(payments)
        .set({
          status: "SUCCEEDED",
          refundReason: null,
          refundAmount: null,
          depositForfeitedAmount: "0",
        })
        .where(eq(payments.bookingId, ids.booking));
    }
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
        payment: {
          status: "SUCCEEDED",
          paidAt: "2031-01-01T00:00:00.000Z",
          refundAmount: null,
          depositForfeitedAmount: "0.00",
        },
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
    const unitId = randomUUID();
    await db.insert(storageUnits).values({
      id: unitId,
      code: unitId,
      facilityId: ids.facility,
      unitTypeId: ids.type,
      status: "OCCUPIED",
    });
    await db.insert(rentals).values({
      bookingId: ids.booking,
      facilityId: ids.facility,
      physicalUnitId: unitId,
      status: "ACTIVE",
      startAt: new Date("2031-02-01T01:00:00Z"),
      expectedEndAt: new Date("2031-04-01T02:00:00Z"),
      depositAmount: "900000",
    });
    await db.update(bookings).set({ status: "CHECKED_IN" }).where(eq(bookings.id, ids.booking));
    try {
      const rental = await app.inject({
        url: `/api/booking/tracking/${code}/rental`,
        headers: { cookie: cookieHeader },
      });
      expect(rental.statusCode).toBe(200);
      expect(rental.json().data).toMatchObject({
        bookingCode: code,
        status: "ACTIVE",
        physicalUnit: { id: unitId, code: unitId },
        expectedEndAt: "2031-04-01T02:00:00.000Z",
      });
      const paymentHistory = await app.inject({
        url: `/api/booking/tracking/${code}/payments`,
        headers: { cookie: cookieHeader },
      });
      expect(paymentHistory.statusCode).toBe(200);
      expect(paymentHistory.body).not.toContain('"provider"');
      expect(paymentHistory.json().data).toMatchObject([
        { paymentCode: expect.any(String), status: "SUCCEEDED", totalAmount: "2700000.00" },
      ]);
      expect(
        (
          await app.inject({
            url: `/api/booking/tracking/${code}/contracts`,
            headers: { cookie: cookieHeader },
          })
        ).json().data,
      ).toEqual([]);
      expect(
        (
          await app.inject({
            url: `/api/booking/tracking/${code}/contracts/${randomUUID()}/pdf`,
            headers: { cookie: cookieHeader },
          })
        ).statusCode,
      ).toBe(404);
    } finally {
      await db.delete(rentals).where(eq(rentals.bookingId, ids.booking));
      await db.delete(storageUnits).where(eq(storageUnits.id, unitId));
      await db.update(bookings).set({ status: "CONFIRMED" }).where(eq(bookings.id, ids.booking));
    }
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

  test("guest access-link requests are generic, audited, rate-limited and idempotent", async () => {
    const remoteAddress = `198.51.100.${randomBytes(1).readUInt8()}`;
    const ipHash = createHmac("sha256", env.BETTER_AUTH_SECRET)
      .update(`guest-access-ip:${remoteAddress}`)
      .digest("hex");
    const bookingHash = createHmac("sha256", env.BETTER_AUTH_SECRET)
      .update(`guest-access-booking:${code.toUpperCase()}`)
      .digest("hex");
    keys.push(`booking:rate:resend:ip:${ipHash}`, `booking:rate:resend:booking:${bookingHash}`);
    const request = (email: string, idempotencyKey = randomUUID()) =>
      app.inject({
        method: "POST",
        url: "/api/booking/access-link",
        headers: { origin },
        remoteAddress,
        payload: { bookingCode: code, email, idempotencyKey },
      });
    const wrong = await request("wrong@example.test");
    expect(wrong.statusCode).toBe(202);
    expect(wrong.body).not.toContain("guest@example.test");

    const idempotencyKey = randomUUID();
    const first = await request("guest@example.test", idempotencyKey);
    const retry = await request("guest@example.test", idempotencyKey);
    const limited = await request("guest@example.test");
    expect(first.statusCode).toBe(202);
    expect(retry.statusCode).toBe(202);
    expect(first.json().data).toEqual(retry.json().data);
    expect(wrong.json().data).toEqual(first.json().data);
    expect(limited.statusCode).toBe(202);
    const audits = await db
      .select()
      .from(bookingAccessAudit)
      .where(eq(bookingAccessAudit.bookingId, ids.booking));
    const outbox = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.bookingId, ids.booking));
    expect(audits).toHaveLength(2);
    expect(audits.map((audit) => audit.action).sort()).toEqual([
      "GUEST_ACCESS_LINK_REJECTED",
      "GUEST_ACCESS_LINK_REQUESTED",
    ]);
    expect(JSON.stringify(audits)).not.toContain("guest@example.test");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.bookingEmail).toMatchObject({
      kind: "TRACKING_LINK",
      bookingCode: code,
      deliveryId: audits.find((audit) => audit.action === "GUEST_ACCESS_LINK_REQUESTED")?.id,
    });
    expect(outbox[0]?.mailExpiresAt?.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);

    const row = outbox[0];
    if (!row) throw new Error("Missing guest link outbox row");
    const queueName = `test-tracking-link-${randomUUID()}`;
    const queue = new Queue<MailJobData>(queueName, { connection: app.redis });
    const oldGrantKey = await app.redis.get(bookingActiveMagicKey(ids.booking));
    const dispatcher = new BookingMailService(
      {
        bookingPayload: async (current, payload, expiresAt) => ({
          ...current,
          mailPayload: payload,
          mailExpiresAt: expiresAt,
        }),
      } as unknown as OutboxRepository,
      {
        queue,
        redis: app.redis,
        secret: mailSecret,
        qrTokenSecret: "test-qr-secret",
        publicAppUrl: origin,
      },
    );
    const delivered: MailMessage[] = [];
    try {
      keys.push(bookingDeliveryKey(row.id), bookingActiveMagicKey(ids.booking));
      expect(await dispatcher.enqueue({ ...row, status: "PROCESSING" }, new Date())).toEqual({
        status: "ENQUEUED",
      });
      const job = await queue.getJob(trackingLinkMailJobId(row.id));
      if (!job) throw new Error("Missing guest tracking-link mail job");
      const payload = JSON.parse(decryptMailPayload(job.data.payload, mailSecret, row.id));
      const token = new URL(payload.trackingUrl).hash.slice("#token=".length);
      const newGrantKey = bookingMagicKey(token);
      keys.push(newGrantKey);
      expect(job.data.kind).toBe("BOOKING_TRACKING_LINK");
      expect(job.data.expiresAt).toBe(row.bookingEmail?.linkExpiresAt);
      expect(job.data.payload).not.toContain(payload.trackingUrl);
      expect(await app.redis.get(bookingActiveMagicKey(ids.booking))).toBe(newGrantKey);
      if (oldGrantKey) expect(await app.redis.exists(oldGrantKey)).toBe(0);
      await processMailJob(
        job.data,
        {
          send: async (message) => {
            delivered.push(message);
            return { providerMessageId: "tracking-link-test" };
          },
        },
        mailSecret,
      );
      expect(delivered).toHaveLength(1);
      expect(delivered[0]?.recipientEmail).toBe("guest@example.test");
      expect(delivered[0]?.text).toContain(payload.trackingUrl);
    } finally {
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });

  test("booking mail runs through BullMQ, retries the same payload and grants tracking access", async () => {
    await app.redis.del(bookingActiveMagicKey(ids.booking));
    const queueName = `test-mail-${randomUUID()}`;
    const connection = new Redis(redisUrl as string, { maxRetriesPerRequest: null });
    const queue = new Queue<MailJobData>(queueName, { connection: app.redis });
    const confirmedAt = new Date(Date.now() - 3600_000);
    const service = createBookingsService(app, {
      redis: app.redis,
      queue,
      config: {
        publicAppUrl: origin,
        magicLinkSecret: mailSecret,
        qrTokenSecret: "test-qr-secret",
      },
    });
    const booking = {
      id: ids.booking,
      paidAt: confirmedAt,
      contactEmail: "guest@example.test",
      bookingCode: code,
    };
    const confirmation = {
      facility: { name: "Tracking facility", address: "Test address" },
      unitTypeName: "Tracking unit",
    };
    const delivered: MailMessage[] = [];
    const adapter = {
      send: async (message: MailMessage) => {
        delivered.push(message);
        if (delivered.length === 1) throw new Error("temporary-provider-failure");
        return { providerMessageId: "test-provider-id" };
      },
    };
    let worker: Worker<MailJobData> | undefined;
    try {
      expect(await service.enqueueConfirmation(booking, confirmation)).toBe("QUEUED");
      expect(await service.enqueueConfirmation(booking, confirmation)).toBe("QUEUED");
      expect(await queue.getWaitingCount()).toBe(1);
      const job = await queue.getJob(mailJobId(ids.booking));
      if (!job) throw new Error("Missing mail job");
      const input = JSON.parse(decryptMailPayload(job.data.payload, mailSecret, ids.booking));
      const token = new URL(input.trackingUrl).hash.slice("#token=".length);
      keys.push(
        `booking:delivery:${ids.booking}`,
        `booking:magic:${createHash("sha256").update(token).digest("hex")}`,
        bookingActiveMagicKey(ids.booking),
      );
      expect(job.data.expiresAt).toBe(
        new Date(confirmedAt.getTime() + BOOKING_ACCESS.magicTtl * 1000).toISOString(),
      );
      expect(job.data.payload).not.toContain(input.trackingUrl);
      worker = new Worker<MailJobData>(
        queueName,
        (item) => processMailJob(item.data, adapter, mailSecret),
        { connection },
      );
      const deadline = Date.now() + 9000;
      while ((await job.getState()) !== "completed" && Date.now() < deadline) await Bun.sleep(100);
      expect(await job.getState()).toBe("completed");
      expect(delivered).toHaveLength(2);
      expect(delivered[0]?.text).toBe(delivered[1]?.text);
      expect(await service.getStatus(ids.booking)).toBe("SENT");
      expect((await exchange(token)).statusCode).toBe(200);
      await expect(
        processMailJob({ ...job.data, expiresAt: new Date(0).toISOString() }, adapter, mailSecret),
      ).rejects.toThrow();
      expect(delivered).toHaveLength(2);
    } finally {
      await worker?.close();
      await queue.obliterate({ force: true });
      await queue.close();
      await connection.quit();
    }
  }, 12_000);

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
    expect(
      (
        await exchange(
          await grant(
            ids.booking,
            new Date(Date.now() + 5 * BOOKING_ACCESS.magicTtl * 1000).toISOString(),
            new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
          ),
        )
      ).statusCode,
    ).toBe(401);
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

  test("forwarded clients have separate quotas while the booking quota stays shared", async () => {
    const clients = [1, 2, 3].map(
      (suffix) =>
        `2001:db8:${randomBytes(2).toString("hex")}:${randomBytes(2).toString("hex")}::${suffix}`,
    );
    const [first = "", second = "", third = ""] = clients;
    const forwarded = (ip: string, url: string, payload: object) =>
      app.inject({
        method: "POST",
        url,
        remoteAddress: "127.0.0.1",
        headers: { origin, "x-forwarded-for": ip },
        payload,
      });
    for (const ip of clients) {
      const hash = (value: string) =>
        createHmac("sha256", env.BETTER_AUTH_SECRET).update(value).digest("hex");
      keys.push(
        `booking:rate:exchange:${hash(ip)}`,
        `booking:rate:resend:ip:${hash(`guest-access-ip:${ip}`)}`,
      );
    }
    for (let attempt = 0; attempt <= BOOKING_ACCESS.rateLimit; attempt++) {
      const response = await forwarded(first, "/api/booking/magic-link/exchange", {
        token: "f".repeat(64),
      });
      expect(response.statusCode).toBe(attempt === BOOKING_ACCESS.rateLimit ? 429 : 401);
    }
    expect(
      (await forwarded(second, "/api/booking/magic-link/exchange", { token: "f".repeat(64) }))
        .statusCode,
    ).toBe(401);

    for (let attempt = 0; attempt <= BOOKING_ACCESS.resendPerIpLimit; attempt++) {
      const unknownCode = randomUUID();
      const hash = createHmac("sha256", env.BETTER_AUTH_SECRET)
        .update(`guest-access-booking:${unknownCode.toUpperCase()}`)
        .digest("hex");
      keys.push(`booking:rate:resend:booking:${hash}`);
      expect(
        (
          await forwarded(first, "/api/booking/access-link", {
            bookingCode: unknownCode,
            email: "unknown@example.test",
            idempotencyKey: randomUUID(),
          })
        ).statusCode,
      ).toBe(202);
    }
    const bookingHash = createHmac("sha256", env.BETTER_AUTH_SECRET)
      .update(`guest-access-booking:${code.toUpperCase()}`)
      .digest("hex");
    await app.redis.del(`booking:rate:resend:booking:${bookingHash}`);
    const outboxCount = async () =>
      (
        await db
          .select()
          .from(notificationOutbox)
          .where(eq(notificationOutbox.bookingId, ids.booking))
      ).length;
    const before = await outboxCount();
    for (let attempt = 0; attempt < BOOKING_ACCESS.resendPerBookingLimit; attempt++)
      expect(
        (
          await forwarded(second, "/api/booking/access-link", {
            bookingCode: code,
            email: "guest@example.test",
            idempotencyKey: randomUUID(),
          })
        ).statusCode,
      ).toBe(202);
    expect(await outboxCount()).toBe(before + BOOKING_ACCESS.resendPerBookingLimit);
    expect(
      (
        await forwarded(third, "/api/booking/access-link", {
          bookingCode: code,
          email: "guest@example.test",
          idempotencyKey: randomUUID(),
        })
      ).statusCode,
    ).toBe(202);
    expect(await outboxCount()).toBe(before + BOOKING_ACCESS.resendPerBookingLimit);
  });
});
