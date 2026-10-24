import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import {
  bookings,
  checkInVerifications,
  db,
  eq,
  facilityOperatingHours,
  payments,
  queryClient,
  unitAssignments,
} from "@metastorage/database";
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { env } from "../../src/config/env";
import { authPlugin } from "../../src/modules/auth/auth.guard";
import { authRoutes } from "../../src/modules/auth/auth.routes";
import { bookingsRoutes } from "../../src/modules/bookings/bookings.routes";
import { checkInsRoutes } from "../../src/modules/check-ins/check-ins.routes";
import { facilityContextPlugin } from "../../src/modules/facilities/facilities.guard";
import { createInspectionFixture } from "../fixtures/inspection-fixture";
import { assertTestDatabase } from "../fixtures/test-database";

const target = process.env.MY_STORAGE_LOCAL_DATABASE_URL;
let fixture: Awaited<ReturnType<typeof createInspectionFixture>>;
let checkInDate: string;
const origin = "http://localhost:3000";

async function withApp(
  environment: typeof env.NODE_ENV,
  run: (app: FastifyInstance, cookie: string) => Promise<void>,
) {
  const previous = env.NODE_ENV;
  env.NODE_ENV = environment;
  const app = Fastify();
  try {
    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    app.register(authPlugin);
    app.register(facilityContextPlugin);
    app.register(authRoutes, { prefix: "/api/auth" });
    app.register(bookingsRoutes, { prefix: "/api" });
    app.register(checkInsRoutes, { prefix: "/api" });
    await app.ready();
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { origin },
      payload: { email: fixture.email, password: fixture.password },
    });
    expect(login.statusCode).toBe(200);
    const cookies = login.headers["set-cookie"];
    const cookie = (Array.isArray(cookies) ? cookies : [cookies ?? ""])
      .map((value) => value.split(";")[0])
      .join("; ");
    await run(app, cookie);
  } finally {
    await app.close();
    env.NODE_ENV = previous;
  }
}

describe.skipIf(!target)("development early check-in through real API and PostgreSQL", () => {
  beforeAll(async () => {
    assertTestDatabase(target);
    fixture = await createInspectionFixture();
    checkInDate = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
    await db.insert(facilityOperatingHours).values({
      facilityId: fixture.facilityId,
      dayOfWeek: 0,
      openTime: "00:00:00",
      closeTime: "23:59:59",
      timezone: "Asia/Ho_Chi_Minh",
    });
    await db.update(bookings).set({ checkInDate }).where(eq(bookings.id, fixture.bookingId));
  });
  beforeEach(async () => {
    await db
      .delete(checkInVerifications)
      .where(eq(checkInVerifications.bookingId, fixture.bookingId));
  });
  afterAll(async () => {
    if (fixture)
      await db
        .delete(facilityOperatingHours)
        .where(eq(facilityOperatingHours.facilityId, fixture.facilityId));
    await fixture?.cleanup();
    await queryClient.end();
  });

  for (const environment of ["production", "test", "development", "develop"] as const) {
    test(`${environment} applies its own early check-in policy to list, lookup and confirm`, async () => {
      await withApp(environment, async (app, cookie) => {
        const allowed = environment === "development" || environment === "develop";
        const headers = { cookie, origin };
        const list = await app.inject({
          url: `/api/bookings/assigned-to-me?fromDate=${checkInDate}`,
          headers,
        });
        expect(list.statusCode).toBe(200);
        expect(
          list.json().data.find((row: { id: string }) => row.id === fixture.bookingId)
            .earlyCheckInAllowed,
        ).toBe(allowed);
        const lookup = await app.inject({
          method: "POST",
          url: "/api/check-ins/lookup",
          headers,
          payload: { type: "BOOKING_CODE", value: fixture.bookingCode, earlyCheckInAllowed: true },
        });
        expect(lookup.statusCode).toBe(200);
        expect(lookup.json().data.eligibility).toEqual({
          canProceed: allowed,
          reasons: allowed ? [] : ["TOO_EARLY"],
        });
        const confirm = await app.inject({
          method: "POST",
          url: `/api/check-ins/${fixture.bookingId}/confirm`,
          headers,
          payload: { earlyCheckInAllowed: true },
        });
        expect(confirm.statusCode).toBe(allowed ? 200 : 409);
        const rows = await db
          .select()
          .from(checkInVerifications)
          .where(eq(checkInVerifications.bookingId, fixture.bookingId));
        expect(rows).toHaveLength(allowed ? 1 : 0);
        if (allowed) expect(rows[0]?.staffId).toBe(fixture.userId);
      });
    });
  }

  test("development retains payment, assignment and authentication checks", async () => {
    await withApp("development", async (app, cookie) => {
      const headers = { cookie, origin };
      const lookup = () =>
        app.inject({
          method: "POST",
          url: "/api/check-ins/lookup",
          headers,
          payload: { type: "BOOKING_CODE", value: fixture.bookingCode },
        });
      const confirm = () =>
        app.inject({ method: "POST", url: `/api/check-ins/${fixture.bookingId}/confirm`, headers });
      try {
        await db
          .update(payments)
          .set({ status: "PENDING" })
          .where(eq(payments.bookingId, fixture.bookingId));
        expect((await lookup()).json().data.eligibility.reasons).toContain("PAYMENT_NOT_SUCCEEDED");
        expect((await confirm()).statusCode).toBe(409);
        await db
          .update(payments)
          .set({ status: "SUCCEEDED" })
          .where(eq(payments.bookingId, fixture.bookingId));
        await db
          .update(unitAssignments)
          .set({ status: "CANCELLED" })
          .where(eq(unitAssignments.id, fixture.assignmentId));
        expect((await lookup()).json().data.eligibility.reasons).toContain("UNIT_NOT_ASSIGNED");
        expect((await confirm()).statusCode).toBe(409);
        await db
          .update(unitAssignments)
          .set({ status: "ACTIVE" })
          .where(eq(unitAssignments.id, fixture.assignmentId));
        const outside = await app.inject({
          method: "POST",
          url: "/api/auth/sign-in/email",
          headers: { origin },
          payload: { email: fixture.outsiderEmail, password: fixture.password },
        });
        expect(outside.statusCode).toBe(200);
        const outsideCookies = outside.headers["set-cookie"];
        const outsideCookie = (
          Array.isArray(outsideCookies) ? outsideCookies : [outsideCookies ?? ""]
        )
          .map((value) => value.split(";")[0])
          .join("; ");
        expect(
          (
            await app.inject({
              method: "POST",
              url: `/api/check-ins/${fixture.bookingId}/confirm`,
              headers: { cookie: outsideCookie, origin },
            })
          ).statusCode,
        ).toBe(403);
        expect(
          (await app.inject({ method: "POST", url: `/api/check-ins/${fixture.bookingId}/confirm` }))
            .statusCode,
        ).toBe(401);
        expect(
          await db
            .select()
            .from(checkInVerifications)
            .where(eq(checkInVerifications.bookingId, fixture.bookingId)),
        ).toHaveLength(0);
      } finally {
        await db
          .update(payments)
          .set({ status: "SUCCEEDED" })
          .where(eq(payments.bookingId, fixture.bookingId));
        await db
          .update(unitAssignments)
          .set({ status: "ACTIVE" })
          .where(eq(unitAssignments.id, fixture.assignmentId));
      }
    });
  });
});
