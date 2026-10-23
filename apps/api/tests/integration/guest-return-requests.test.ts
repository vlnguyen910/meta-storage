import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { randomBytes, randomUUID } from "node:crypto";
import {
  bookings,
  db,
  eq,
  facilityReturnCalendars,
  notificationOutbox,
  queryClient,
  rentals,
  returnAudit,
  returnRequests,
} from "@metastorage/database";
import {
  bookingActiveMagicKey,
  bookingDeliveryKey,
  bookingMagicKey,
  bookingSessionKey,
  createBookingTrackingLink,
} from "@metastorage/shared/booking-access";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { redisPlugin } from "../../src/common/redis/plugin";
import { env } from "../../src/config/env";
import { authPlugin } from "../../src/modules/auth/auth.guard";
import { authRoutes } from "../../src/modules/auth/auth.routes";
import { bookingsRoutes } from "../../src/modules/bookings/bookings.routes";
import { facilityContextPlugin } from "../../src/modules/facilities/facilities.guard";
import { guestRentalAccessRoutes } from "../../src/modules/guest-rental-access/guest-rental-access.routes";
import { returnsRoutes } from "../../src/modules/returns/returns.routes";
import { createGuestReturnFixture } from "../fixtures/guest-return-fixture";
import { assertTestDatabase } from "../fixtures/test-database";

const target = process.env.MY_STORAGE_LOCAL_DATABASE_URL;
const redisUrl = process.env.REDIS_TEST_URL;
const origin = "http://localhost:3000";
const app = Fastify();
const keys: string[] = [];
let fixture: Awaited<ReturnType<typeof createGuestReturnFixture>>;
let cookie = "";
const path = (suffix: string, code = fixture.bookingCode) =>
  `/api/booking/tracking/${code}/${suffix}`;
const input = () => ({ date: fixture.date, slotId: fixture.slotId, reason: "Trả kho theo lịch" });
const request = (
  method: "GET" | "POST",
  suffix: string,
  payload?: unknown,
  headers = { cookie, origin },
) => app.inject({ method, url: path(suffix), headers, payload });

async function grant() {
  const deliveryId = randomUUID();
  const link = await createBookingTrackingLink(app.redis, {
    bookingId: fixture.bookingId,
    deliveryId,
    confirmedAt: new Date(),
    secret: env.BOOKING_MAGIC_LINK_SECRET,
    publicAppUrl: env.PUBLIC_APP_URL,
    replaceExisting: true,
  });
  const token = new URLSearchParams(new URL(link.trackingUrl).hash.slice(1)).get("token") ?? "";
  expect(token).toHaveLength(64);
  keys.push(
    bookingDeliveryKey(deliveryId),
    bookingMagicKey(token),
    bookingActiveMagicKey(fixture.bookingId),
  );
  const exchanged = await app.inject({
    method: "POST",
    url: "/api/booking/magic-link/exchange",
    headers: { origin },
    payload: { token },
  });
  expect(exchanged.statusCode).toBe(200);
  const header = exchanged.headers["set-cookie"];
  const result = (Array.isArray(header) ? header[0] : header)?.split(";")[0] ?? "";
  keys.push(bookingSessionKey(result.split("=")[1] ?? ""));
  return result;
}

describe.skipIf(!target || !redisUrl)(
  "Guest return requests through booking magic-link sessions",
  () => {
    beforeAll(async () => {
      assertTestDatabase(target);
      const redis = new URL(redisUrl ?? "");
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(redis.hostname) ||
        !/^\/(?:[1-9]|1[0-5])$/.test(redis.pathname)
      )
        throw new Error("Use isolated loopback Redis test DB 1–15");
      fixture = await createGuestReturnFixture();
      app.decorate("db", db);
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);
      setupErrorHandler(app);
      await app.register(redisPlugin, { url: redisUrl });
      app.register(authPlugin);
      app.register(facilityContextPlugin);
      app.register(authRoutes, { prefix: "/api/auth" });
      app.register(bookingsRoutes, { prefix: "/api" });
      app.register(guestRentalAccessRoutes, { prefix: "/api" });
      app.register(returnsRoutes, { prefix: "/api" });
      await app.ready();
    });
    beforeEach(async () => {
      await fixture.reset();
      cookie = await grant();
    });
    afterAll(async () => {
      if (keys.length && app.redis) await app.redis.del(...keys);
      await app.close();
      if (fixture) await fixture.cleanup();
      await queryClient.end();
    });

    test("requires a valid session for the exact booking, never just a code or account identity", async () => {
      for (const headers of [
        {},
        { cookie: `metastorage_booking_session=${randomBytes(32).toString("hex")}` },
      ]) {
        expect(
          (await request("GET", "return-requests", undefined, { ...headers, origin })).statusCode,
        ).toBe(401);
        expect(
          (await request("POST", "return-requests", input(), { ...headers, origin })).statusCode,
        ).toBe(401);
      }
      expect(
        (
          await app.inject({
            method: "POST",
            url: path("return-requests", "OTHER-BOOKING"),
            headers: { cookie, origin },
            payload: input(),
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: "POST",
            url: `/api/rentals/${fixture.rentalId}/return-requests`,
            headers: { cookie, origin },
            payload: input(),
          })
        ).statusCode,
      ).toBe(401);
    });

    test("account authentication does not grant a booking tracking session", async () => {
      const account = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: { origin },
        payload: { email: fixture.managerEmail, password: fixture.password },
      });
      expect(account.statusCode).toBe(200);
      const headers = account.headers["set-cookie"];
      const accountCookie = (Array.isArray(headers) ? headers : [headers ?? ""])
        .map((value) => value.split(";")[0])
        .join("; ");
      expect(
        (await request("GET", "return-requests", undefined, { cookie: accountCookie, origin }))
          .statusCode,
      ).toBe(401);
    });

    test("uses configured slots, 24-hour notice and strict input/Origin validation", async () => {
      const slots = await request("GET", `return-slots?date=${fixture.date}`);
      expect(slots.statusCode).toBe(200);
      expect(
        slots.json().data.some((slot: { slotId: string }) => slot.slotId === fixture.slotId),
      ).toBe(true);
      expect(slots.headers["cache-control"]).toBe("no-store");
      expect(
        (
          await request("POST", "return-requests", input(), {
            cookie,
            origin: "https://other.example",
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (await request("POST", "return-requests", input(), { cookie, origin: "" })).statusCode,
      ).toBe(403);
      for (const payload of [
        { ...input(), reason: " " },
        { ...input(), rentalId: randomUUID() },
        { ...input(), actorId: fixture.managerId },
        { ...input(), date: "invalid" },
      ]) {
        expect((await request("POST", "return-requests", payload)).statusCode).toBe(400);
      }
      expect(
        (await request("POST", "return-requests", { ...input(), slotId: randomUUID() })).statusCode,
      ).toBe(409);
      const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
      expect((await request("GET", `return-slots?date=${today}`)).json().data).toEqual([]);
      expect(
        (await request("POST", "return-requests", { ...input(), date: today })).statusCode,
      ).toBe(422);
      await db
        .update(facilityReturnCalendars)
        .set({ holidays: [fixture.date] })
        .where(eq(facilityReturnCalendars.facilityId, fixture.facilityId));
      expect((await request("GET", `return-slots?date=${fixture.date}`)).json().data).toEqual([]);
      expect((await request("POST", "return-requests", input())).statusCode).toBe(409);
    });

    test("persists one guest request, transition, audit and manager notification under concurrent submission", async () => {
      const results = await Promise.all([
        request("POST", "return-requests", input()),
        request("POST", "return-requests", input()),
      ]);
      expect(results.map((result) => result.statusCode).sort()).toEqual([201, 409]);
      const [row] = await db
        .select()
        .from(returnRequests)
        .where(eq(returnRequests.rentalId, fixture.rentalId));
      if (!row) throw new Error("Expected the persisted guest request");
      expect(row?.createdBy).toBeNull();
      expect(row?.status).toBe("PENDING");
      expect(
        (await db.select().from(bookings).where(eq(bookings.id, fixture.bookingId)))[0]?.userId,
      ).toBeNull();
      expect(
        (await db.select().from(rentals).where(eq(rentals.id, fixture.rentalId)))[0]?.status,
      ).toBe("RETURN_PENDING");
      const [audit] = await db.select().from(returnAudit).where(eq(returnAudit.requestId, row.id));
      expect(audit?.actorId).toBeNull();
      expect(audit?.details).toMatchObject({
        source: "GUEST_MAGIC_LINK",
        bookingId: fixture.bookingId,
      });
      expect(JSON.stringify(audit)).not.toContain(cookie.split("=")[1] ?? "");
      expect(
        (
          await db
            .select()
            .from(notificationOutbox)
            .where(eq(notificationOutbox.bookingId, fixture.bookingId))
        ).some((event) => event.recipientRole === "FACILITY_MANAGER"),
      ).toBe(true);
      const list = await request("GET", "return-requests");
      expect(list.json().data).toHaveLength(1);
      expect(list.json().data[0]).toMatchObject({
        id: row.id,
        status: "PENDING",
        reason: input().reason,
      });
      expect(list.json().data[0]).not.toHaveProperty("audit");
      expect(
        (await request("GET", `return-slots?date=${fixture.date}`))
          .json()
          .data.some((slot: { slotId: string }) => slot.slotId === fixture.slotId),
      ).toBe(true);
    });

    test("FM can assign a guest request and assigned Staff confirms through the existing workflow", async () => {
      const created = await request("POST", "return-requests", input());
      expect(created.statusCode).toBe(201);
      const id = created.json().data.id;
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: { origin },
        payload: { email: fixture.managerEmail, password: fixture.password },
      });
      expect(login.statusCode).toBe(200);
      const cookies = login.headers["set-cookie"];
      const managerCookie = (Array.isArray(cookies) ? cookies : [cookies ?? ""])
        .map((value) => value.split(";")[0])
        .join("; ");
      const detail = await app.inject({
        method: "GET",
        url: `/api/return-requests/${id}`,
        headers: { cookie: managerCookie },
      });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().data.audit[0].actorId).toBeNull();
      const assigned = await app.inject({
        method: "PATCH",
        url: `/api/return-requests/${id}/staff`,
        headers: { cookie: managerCookie, origin },
        payload: { expectedVersion: 0, staffId: fixture.userId, reason: "Phân công tiếp nhận" },
      });
      expect(assigned.statusCode).toBe(200);
      const staffLogin = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: { origin },
        payload: { email: fixture.email, password: fixture.password },
      });
      expect(staffLogin.statusCode).toBe(200);
      const staffHeaders = staffLogin.headers["set-cookie"];
      const staffCookie = (Array.isArray(staffHeaders) ? staffHeaders : [staffHeaders ?? ""])
        .map((value) => value.split(";")[0])
        .join("; ");
      const confirmed = await app.inject({
        method: "POST",
        url: `/api/return-requests/${id}/confirm`,
        headers: { cookie: staffCookie, origin },
        payload: { expectedVersion: assigned.json().data.version },
      });
      expect(confirmed.statusCode).toBe(200);
      expect((await request("GET", "return-requests")).json().data[0].status).toBe("CONFIRMED");
      expect(
        (await request("GET", `return-slots?date=${fixture.date}`))
          .json()
          .data.some((slot: { slotId: string }) => slot.slotId === fixture.slotId),
      ).toBe(false);
    });

    test("closed rentals cannot create requests and expired/revoked sessions lose access", async () => {
      await db
        .update(rentals)
        .set({ status: "CLOSED", closedAt: new Date() })
        .where(eq(rentals.id, fixture.rentalId));
      expect((await request("POST", "return-requests", input())).statusCode).toBe(409);
      expect((await request("GET", `return-slots?date=${fixture.date}`)).statusCode).toBe(409);
      const sessionKey = bookingSessionKey(cookie.split("=")[1] ?? "");
      const raw = JSON.parse((await app.redis.get(sessionKey)) ?? "{}");
      await app.redis.set(
        sessionKey,
        JSON.stringify({ ...raw, expiresAt: new Date(0).toISOString() }),
        "EX",
        60,
      );
      expect((await request("GET", "return-requests")).statusCode).toBe(401);
      expect((await request("POST", "return-requests", input())).statusCode).toBe(401);
      cookie = await grant();
      const revoked = await app.inject({
        method: "POST",
        url: "/api/booking/session/revoke",
        headers: { cookie, origin },
      });
      expect(revoked.statusCode).toBe(204);
      expect((await request("GET", "return-requests")).statusCode).toBe(401);
      expect((await request("POST", "return-requests", input())).statusCode).toBe(401);
    });
    test("a valid booking session cannot submit before a rental exists", async () => {
      await db.delete(rentals).where(eq(rentals.id, fixture.rentalId));
      expect((await request("GET", "return-requests")).statusCode).toBe(404);
      expect((await request("POST", "return-requests", input())).statusCode).toBe(404);
    });
  },
);
