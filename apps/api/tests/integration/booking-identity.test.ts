import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import {
  accounts,
  bookings,
  capacityAllocations,
  checkInSlots,
  db,
  eq,
  facilities,
  facilityUnitTypes,
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

async function draft(sessionCookie?: string, extra: Record<string, unknown> = {}) {
  const response = await app.inject({
    method: "POST",
    url: "/api/bookings/drafts",
    headers: sessionCookie ? { cookie: sessionCookie } : {},
    payload: { ...input, ...extra },
  });
  expect(response.statusCode).toBe(201);
  return response.json().data.id as string;
}

describe.skipIf(!testUrl)("Booking contact and optional account ownership with PostgreSQL", () => {
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
      await tx.insert(unitTypes).values({
        id: ids.type,
        code: ids.type,
        name: "Identity test",
        sizeLabel: "S",
        lengthM: 1,
        widthM: 1,
        heightM: 1,
        monthlyPrice: 1000000,
      });
      await tx.insert(facilityUnitTypes).values({ facilityId: ids.facility, unitTypeId: ids.type });
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
      await tx.delete(facilityUnitTypes).where(eq(facilityUnitTypes.facilityId, ids.facility));
      await tx.delete(facilities).where(eq(facilities.id, ids.facility));
      await tx.delete(unitTypes).where(eq(unitTypes.id, ids.type));
      await tx.delete(checkInSlots).where(eq(checkInSlots.id, ids.slot));
      await tx.delete(users).where(inArray(users.id, [ids.user, ids.other]));
    });
  });

  test("guest cannot supply ownership; login never attaches bookings with matching email", async () => {
    const id = await draft(undefined, { userId: ids.user });
    await db
      .update(bookings)
      .set({ contactName: "Guest", contactEmail: email, contactPhone: "0900000000" })
      .where(eq(bookings.id, id));
    await login();
    expect((await db.select().from(bookings).where(eq(bookings.id, id)))[0]?.userId).toBeNull();
  });

  test("authenticated draft uses the session account, ignoring body userId", async () => {
    const id = await draft(cookie, { userId: ids.other });
    expect((await db.select().from(bookings).where(eq(bookings.id, id)))[0]?.userId).toBe(ids.user);
  });

  test("signup checks account duplication without a Customer profile", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/customer-sign-up",
      payload: {
        name: "Duplicate",
        email,
        phone: "0900000000",
        password,
        confirmPassword: password,
        callbackTarget: "web",
      },
    });
    expect(response.statusCode).toBe(409);
  });

  test("inactive accounts cannot create a draft using an existing session", async () => {
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

  test("non-DRAFT requires complete contact; same email retains each booking contact", async () => {
    const first = await draft();
    const second = await draft();
    await expect(
      db.update(bookings).set({ status: "CONFIRMED" }).where(eq(bookings.id, first)).execute(),
    ).rejects.toThrow();
    await expect(
      db.update(bookings).set({ contactName: "Partial" }).where(eq(bookings.id, first)).execute(),
    ).rejects.toThrow();
    await db
      .update(bookings)
      .set({
        status: "CONFIRMED",
        contactName: "First contact",
        contactEmail: email,
        contactPhone: "0900000001",
      })
      .where(eq(bookings.id, first));
    await db
      .update(bookings)
      .set({
        status: "CONFIRMED",
        contactName: "Second contact",
        contactEmail: email,
        contactPhone: "0900000002",
      })
      .where(eq(bookings.id, second));
    const repository = new BookingsRepository(db);
    expect(await repository.findBookingById(first)).toMatchObject({
      contactName: "First contact",
      contactPhone: "0900000001",
    });
    expect(await repository.findBookingById(second)).toMatchObject({
      contactName: "Second contact",
      contactPhone: "0900000002",
    });
  });

  test("rental history uses Booking.userId and rejects guest or other-account rental access", async () => {
    const rentalIds: string[] = [];
    for (const userId of [ids.user, ids.other, null]) {
      const id = await draft();
      await db
        .update(bookings)
        .set({
          userId,
          status: "CHECKED_IN",
          contactName: "Contact",
          contactEmail: email,
          contactPhone: "0900000000",
        })
        .where(eq(bookings.id, id));
      const [rental] = await db
        .insert(rentals)
        .values({
          bookingId: id,
          facilityId: ids.facility,
          physicalUnitId: ids.unit,
          startAt: new Date("2032-02-01T04:00:00Z"),
          expectedEndAt: new Date("2032-03-01T04:00:00Z"),
          depositAmount: "1000000",
        })
        .returning();
      if (!rental) throw new Error("Rental fixture missing");
      rentalIds.push(rental.id);
    }
    const mine = await app.inject({ method: "GET", url: "/api/rentals/mine", headers: { cookie } });
    expect(mine.statusCode).toBe(200);
    expect(mine.json().data.items.map((item: { id: string }) => item.id)).toEqual([rentalIds[0]]);
    for (const [index, id] of rentalIds.entries()) {
      const response = await app.inject({
        method: "GET",
        url: `/api/rentals/${id}`,
        headers: { cookie },
      });
      expect(response.statusCode).toBe(index === 0 ? 200 : 404);
    }
    expect((await app.inject({ method: "GET", url: "/api/rentals/mine" })).statusCode).toBe(401);
  });

  test("legacy payment persists the draft contact without a Customer and replays it", async () => {
    const pricing = {
      monthlyRateSnapshot: "1000000",
      rentalFeeAmount: "1000000",
      depositAmount: "1000000",
      totalAmount: "2000000",
      currency: "VND",
    };
    const [reservation] = await db
      .insert(reservationDrafts)
      .values({
        facilityId: ids.facility,
        unitTypeId: ids.type,
        checkInAt: new Date("2032-02-01T04:00:00Z"),
        rentalEndAt: new Date("2032-03-01T04:00:00Z"),
        durationMonths: 1,
        contactName: "Payment contact",
        contactEmail: email,
        contactPhone: "0900000099",
        pricingStatus: "PRICED",
        pricing,
      })
      .returning();
    if (!reservation) throw new Error("Reservation fixture missing");
    const holdTokenHash = createHash("sha256").update(randomUUID()).digest("hex");
    const [hold] = await db
      .insert(capacityAllocations)
      .values({
        facilityId: ids.facility,
        unitTypeId: ids.type,
        referenceId: reservation.id,
        kind: "HOLD",
        status: "ACTIVE",
        accessTokenHash: holdTokenHash,
        expiresAt: new Date(Date.now() + 600000),
        startsAt: reservation.checkInAt,
        endsAt: reservation.rentalEndAt,
      })
      .returning();
    if (!hold) throw new Error("Hold fixture missing");
    const repository = new PaymentsRepository(db);
    const idempotencyKey = randomUUID();
    const payment = await repository.createPendingPayment({
      draftId: reservation.id,
      holdTokenHash,
      provider: "MOCK",
      pricing,
      paymentCode: randomUUID().slice(0, 20),
      idempotencyKey,
    });
    if (!payment) throw new Error("Payment fixture missing");
    const completed = await repository.completePendingPayment({
      paymentId: payment.payment.id,
      providerPaymentId: randomUUID(),
      draftId: reservation.id,
      holdId: hold.id,
      paidAt: new Date(),
    });
    expect(completed?.booking).toMatchObject({
      contactName: "Payment contact",
      contactEmail: email,
      contactPhone: "0900000099",
      userId: null,
      status: "CONFIRMED",
    });
    const replay = await repository.findCompletedByIdempotencyKey(idempotencyKey, holdTokenHash);
    expect(replay?.booking.id).toBe(completed?.booking.id);
    expect(replay?.booking.contactPhone).toBe("0900000099");
  });

  test("deleting an account preserves booking and contact, clearing only history ownership", async () => {
    const id = await draft();
    await db
      .update(bookings)
      .set({
        userId: ids.other,
        contactName: "Retained",
        contactEmail: email,
        contactPhone: "0900000010",
      })
      .where(eq(bookings.id, id));
    await db.delete(users).where(eq(users.id, ids.other));
    expect((await db.select().from(bookings).where(eq(bookings.id, id)))[0]).toMatchObject({
      userId: null,
      contactName: "Retained",
      contactEmail: email,
    });
  });
});
