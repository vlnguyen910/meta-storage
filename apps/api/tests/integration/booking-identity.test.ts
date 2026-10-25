import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  accounts,
  bookings,
  capacityAllocations,
  checkInSlots,
  db,
  eq,
  facilities,
  inArray,
  notificationOutbox,
  or,
  payments,
  rentals,
  reservationDrafts,
  storageUnits,
  unitTypes,
  users,
} from "@metastorage/database";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { auth } from "../../src/modules/auth/auth";
import { authPlugin } from "../../src/modules/auth/auth.guard";
import { authRoutes } from "../../src/modules/auth/auth.routes";
import { BookingsRepository } from "../../src/modules/bookings/bookings.repository";
import { bookingsRoutes } from "../../src/modules/bookings/bookings.routes";
import { PaymentsRepository } from "../../src/modules/payments/payments.repository";
import { rentalsRoutes } from "../../src/modules/rentals/rentals.routes";
import { createTestUnitType, deleteTestUnitTypes } from "../fixtures/facility-catalog";

const testUrl = process.env.BOOKING_TEST_DATABASE_URL;
const ids = {
  facility: randomUUID(),
  type: randomUUID(),
  unit: randomUUID(),
  slot: randomUUID(),
  user: randomUUID(),
  other: randomUUID(),
};
const email = `${ids.user}@example.test`;
const password = "Booking-test-password-123";
const input = {
  facilityId: ids.facility,
  unitTypeId: ids.type,
  checkInSlotId: ids.slot,
  checkInDate: "2031-02-01",
  durationMonths: 1,
};
const app = Fastify();
let fixturesCreated = false;
let cookie = "";

async function login() {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    payload: { email, password },
  });
  expect(response.statusCode).toBe(200);
  return response.cookies.map((item) => `${item.name}=${item.value}`).join("; ");
}

async function draft(sessionCookie: string = cookie, extra: Record<string, unknown> = {}) {
  const response = await app.inject({
    method: "POST",
    url: "/api/bookings/drafts",
    headers: sessionCookie ? { cookie: sessionCookie } : {},
    payload: { ...input, ...extra },
  });
  expect(response.statusCode).toBe(201);
  return response.json().data.id as string;
}

describe.skipIf(!testUrl)("Account-owned booking identity with PostgreSQL", () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== testUrl)
      throw new Error("DATABASE_URL must match isolated BOOKING_TEST_DATABASE_URL");
    const context = await auth.$context;
    const hash = await context.password.hash(password);
    await db.transaction(async (tx) => {
      await tx.insert(users).values([
        {
          id: ids.user,
          name: "Booking account",
          email,
          emailVerified: true,
          role: "CUSTOMER",
          status: "ACTIVE",
        },
        {
          id: ids.other,
          name: "Other account",
          email: `${ids.other}@example.test`,
          emailVerified: true,
          role: "CUSTOMER",
          status: "ACTIVE",
        },
      ]);
      await tx.insert(accounts).values({
        id: randomUUID(),
        userId: ids.user,
        accountId: ids.user,
        providerId: "credential",
        password: hash,
      });
      await tx
        .insert(facilities)
        .values({ id: ids.facility, code: ids.facility, name: "Identity test", address: "Test" });
      await createTestUnitType(tx, {
        facilityId: ids.facility,
        id: ids.type,
        code: ids.type,
        name: "Identity test",
        sizeLabel: "S",
        lengthM: 1,
        widthM: 1,
        heightM: 1,
        monthlyPrice: 1000000,
      });

      await tx
        .insert(storageUnits)
        .values({ id: ids.unit, code: ids.unit, facilityId: ids.facility, unitTypeId: ids.type });
      await tx
        .insert(checkInSlots)
        .values({ id: ids.slot, name: "Identity test", startTime: "11:00", endTime: "12:00" });
    });
    fixturesCreated = true;
    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    await app.register(authPlugin);
    await app.register(authRoutes, { prefix: "/api/auth" });
    await app.register(bookingsRoutes, { prefix: "/api" });
    await app.register(rentalsRoutes, { prefix: "/api/rentals" });
    await app.ready();
    cookie = await login();
  });

  afterAll(async () => {
    await app.close();
    if (!fixturesCreated) return;
    await db.transaction(async (tx) => {
      const bookingIds = (
        await tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(eq(bookings.facilityId, ids.facility))
      ).map((item) => item.id);
      const draftIds = (
        await tx
          .select({ id: reservationDrafts.id })
          .from(reservationDrafts)
          .where(eq(reservationDrafts.facilityId, ids.facility))
      ).map((item) => item.id);
      await tx.delete(notificationOutbox).where(eq(notificationOutbox.facilityId, ids.facility));
      await tx.delete(rentals).where(eq(rentals.facilityId, ids.facility));
      if (bookingIds.length || draftIds.length)
        await tx
          .delete(payments)
          .where(or(inArray(payments.bookingId, bookingIds), inArray(payments.draftId, draftIds)));
      await tx.delete(bookings).where(eq(bookings.facilityId, ids.facility));
      await tx.delete(reservationDrafts).where(eq(reservationDrafts.facilityId, ids.facility));
      await tx.delete(capacityAllocations).where(eq(capacityAllocations.facilityId, ids.facility));
      await tx.delete(storageUnits).where(eq(storageUnits.id, ids.unit));
      await deleteTestUnitTypes(tx, eq(unitTypes.id, ids.type));

      await tx.delete(facilities).where(eq(facilities.id, ids.facility));
      await tx.delete(checkInSlots).where(eq(checkInSlots.id, ids.slot));
      await tx.delete(users).where(inArray(users.id, [ids.user, ids.other]));
    });
  });

  beforeEach(async () => {
    await db.delete(notificationOutbox).where(eq(notificationOutbox.facilityId, ids.facility));
    await db
      .delete(payments)
      .where(
        inArray(
          payments.bookingId,
          db
            .select({ id: bookings.id })
            .from(bookings)
            .where(eq(bookings.facilityId, ids.facility)),
        ),
      );
    await db.delete(capacityAllocations).where(eq(capacityAllocations.facilityId, ids.facility));
    await db.delete(bookings).where(eq(bookings.facilityId, ids.facility));
    await db.update(users).set({ phone: null }).where(eq(users.id, ids.user));
  });

  test("anonymous callers cannot create bookings even when supplying a user ID", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/bookings/drafts",
      payload: { ...input, userId: ids.user },
    });
    expect(response.statusCode).toBe(401);
  });

  test("draft owner comes from the session and no guest credential is returned", async () => {
    const id = await draft(cookie, { userId: ids.other });
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    expect(booking?.userId).toBe(ids.user);
    expect(booking).not.toHaveProperty("accessTokenHash");
    expect(booking).not.toHaveProperty("contactName");
    expect(booking).not.toHaveProperty("contactEmail");
    expect(booking?.contactPhone).toBeNull();
  });

  test("an account may have no phone and can still create a booking draft", async () => {
    const id = await draft();
    expect((await db.select().from(bookings).where(eq(bookings.id, id)))[0]?.status).toBe("DRAFT");
  });

  test("database rejects a missing owner and deletion of an owner with bookings", async () => {
    const id = await draft();
    await expect(
      db
        .update(bookings)
        .set({ userId: null as never })
        .where(eq(bookings.id, id))
        .execute(),
    ).rejects.toThrow();
    await expect(db.delete(users).where(eq(users.id, ids.user)).execute()).rejects.toThrow();
    expect((await db.select().from(bookings).where(eq(bookings.id, id)))[0]?.userId).toBe(ids.user);
  });

  test("inactive customer sessions cannot create a draft", async () => {
    await db.update(users).set({ status: "INACTIVE" }).where(eq(users.id, ids.user));
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/bookings/drafts",
        headers: { cookie },
        payload: input,
      });
      expect(response.statusCode).toBe(403);
    } finally {
      await db.update(users).set({ status: "ACTIVE" }).where(eq(users.id, ids.user));
    }
  });

  const checkout = (bookingId: string, contactPhone?: string, userId = ids.user) =>
    new PaymentsRepository(db).prepareBookingPayment({
      bookingId,
      userId,
      contactPhone,
      holdTokenHash: randomUUID(),
      idempotencyKey: randomUUID(),
      paymentCode: randomUUID().replaceAll("-", ""),
      holdDurationMs: 600000,
    });

  test("payment requires a booking phone when profile phone is missing, without side effects", async () => {
    const id = await draft();
    await expect(checkout(id)).rejects.toMatchObject({ statusCode: 400 });
    expect(await db.select().from(payments).where(eq(payments.bookingId, id))).toHaveLength(0);
    expect(
      await db.select().from(capacityAllocations).where(eq(capacityAllocations.referenceId, id)),
    ).toHaveLength(0);
  });

  test("payment falls back to profile phone", async () => {
    await db.update(users).set({ phone: "0901234567" }).where(eq(users.id, ids.user));
    const id = await draft();
    await checkout(id);
    expect((await db.select().from(bookings).where(eq(bookings.id, id)))[0]?.contactPhone).toBe(
      "0901234567",
    );
  });

  test("entered phone belongs only to the booking and never updates the profile", async () => {
    const id = await draft();
    await checkout(id, "+84901234567");
    expect((await db.select().from(bookings).where(eq(bookings.id, id)))[0]?.contactPhone).toBe(
      "+84901234567",
    );
    expect((await db.select().from(users).where(eq(users.id, ids.user)))[0]?.phone).toBeNull();
  });

  test("explicit booking phone overrides the profile and remains stable after profile changes", async () => {
    await db.update(users).set({ phone: "0901234567" }).where(eq(users.id, ids.user));
    const id = await draft();
    await checkout(id, "+84908765432");
    await db.update(users).set({ phone: "0901111111" }).where(eq(users.id, ids.user));
    expect((await db.select().from(bookings).where(eq(bookings.id, id)))[0]?.contactPhone).toBe(
      "+84908765432",
    );
  });

  test("another customer cannot pay for this booking", async () => {
    const id = await draft();
    await expect(checkout(id, "+84901234567", ids.other)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(await db.select().from(payments).where(eq(payments.bookingId, id))).toHaveLength(0);
  });

  test("operational reads use current account name/email and the booking phone", async () => {
    const id = await draft();
    await db
      .update(bookings)
      .set({ status: "CONFIRMED", contactPhone: "+84901234567" })
      .where(eq(bookings.id, id));
    await db.update(users).set({ name: "Updated customer" }).where(eq(users.id, ids.user));
    const booking = await new BookingsRepository(db).findBookingById(id);
    expect(booking).toMatchObject({
      contactName: "Updated customer",
      contactEmail: email,
      contactPhone: "+84901234567",
    });
  });
});
