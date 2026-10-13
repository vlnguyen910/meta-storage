import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
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
import { decryptMailPayload, type MailJobData, mailJobId } from "@metastorage/shared/mail";
import { Queue, Worker } from "bullmq";
import Fastify from "fastify";
import { validatorCompiler } from "fastify-type-provider-zod";
import Redis from "ioredis";
import { processMailJob } from "../../../worker/src/mail/mail.job";
import type { MailMessage } from "../../../worker/src/mail/mail.types";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { redisPlugin } from "../../src/common/redis/plugin";
import { bookingsRoutes } from "../../src/modules/bookings/bookings.routes";
import { createBookingsService } from "../../src/modules/bookings/bookings.service";

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

  test("booking mail runs through BullMQ, retries the same payload and grants tracking access", async () => {
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
