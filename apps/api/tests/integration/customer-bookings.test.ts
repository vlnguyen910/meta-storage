import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  accounts,
  bookings,
  checkInSlots,
  db,
  eq,
  facilities,
  facilityAssignments,
  facilityUnitTypes,
  inArray,
  payments,
  queryClient,
  sql,
  unitTypes,
  users,
} from "@metastorage/database";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { auth } from "../../src/modules/auth/auth";
import { authPlugin } from "../../src/modules/auth/auth.guard";
import { authRoutes } from "../../src/modules/auth/auth.routes";
import { bookingsRoutes } from "../../src/modules/bookings/bookings.routes";
import { assertTestDatabase } from "../fixtures/test-database";

const target = process.env.MY_STORAGE_LOCAL_DATABASE_URL;
const app = Fastify();
const ids = {
  facility: randomUUID(),
  type: randomUUID(),
  slot: randomUUID(),
  owner: randomUUID(),
  other: randomUUID(),
  staff: randomUUID(),
};
const password = "CustomerBookingTest123!";
const createdAt = "2032-02-01T03:00:00.123456Z";
const bookingIds: string[] = [];
let ownerCookie = "";
let otherCookie = "";
let staffCookie = "";
let fixtureStarted = false;

async function login(id: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    payload: { email: `${id}@example.test`, password },
  });
  expect(response.statusCode).toBe(200);
  return response.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function createBooking(userId: string | null, status: string) {
  const id = randomUUID();
  const [booking] = await db
    .insert(bookings)
    .values({
      id,
      userId,
      facilityId: ids.facility,
      unitTypeId: ids.type,
      checkInSlotId: ids.slot,
      checkInDate: "2032-02-01",
      rentalEndAt: new Date("2032-04-01T03:00:00Z"),
      requestedMonths: 2,
      monthlyRateSnapshot: "900000",
      rentalFeeAmount: "1800000",
      depositAmount: "900000",
      totalAmount: "2700000",
      contactName: status === "DRAFT" ? null : "Customer booking fixture",
      contactEmail: status === "DRAFT" ? null : `${ids.owner}@example.test`,
      contactPhone: status === "DRAFT" ? null : "0900000000",
      accessTokenHash: "private-access-hash",
      qrTokenHash: status === "DRAFT" ? null : `private-qr-hash-${id}`,
      status,
    })
    .returning({ id: bookings.id });
  if (!booking) throw new Error("Missing booking fixture");
  bookingIds.push(booking.id);
  await db
    .update(bookings)
    .set({ createdAt: sql`${createdAt}::timestamptz` })
    .where(eq(bookings.id, booking.id));
  return booking.id;
}

function read(path: string, cookie = ownerCookie) {
  return app.inject({ method: "GET", url: `/api/bookings${path}`, headers: { cookie } });
}

describe.skipIf(!target)("Customer booking reads against isolated PostgreSQL", () => {
  beforeAll(async () => {
    assertTestDatabase(target, process.env);

    const passwordHash = await (await auth.$context).password.hash(password);
    fixtureStarted = true;
    await db.transaction(async (tx) => {
      for (const [id, role] of [
        [ids.owner, "CUSTOMER"],
        [ids.other, "CUSTOMER"],
        [ids.staff, "FACILITY_STAFF"],
      ] as const) {
        await tx.insert(users).values({
          id,
          name: "Customer booking fixture",
          email: `${id}@example.test`,
          emailVerified: true,
          role,
          status: "ACTIVE",
        });
        await tx.insert(accounts).values({
          id: randomUUID(),
          userId: id,
          accountId: id,
          providerId: "credential",
          password: passwordHash,
        });
      }
      await tx.insert(facilities).values({
        id: ids.facility,
        code: ids.facility,
        name: "Customer booking fixture",
        address: "Local test facility",
      });
      await tx.insert(facilityAssignments).values({
        userId: ids.staff,
        facilityId: ids.facility,
        role: "FACILITY_STAFF",
        isActive: true,
      });
      await tx.insert(unitTypes).values({
        id: ids.type,
        code: ids.type,
        name: "Customer booking fixture",
        sizeLabel: "S",
        lengthM: 1,
        widthM: 1,
        heightM: 1,
        monthlyPrice: 900000,
      });
      await tx.insert(facilityUnitTypes).values({ facilityId: ids.facility, unitTypeId: ids.type });
      await tx.insert(checkInSlots).values({
        id: ids.slot,
        name: "Customer booking fixture",
        startTime: "09:00",
        endTime: "10:30",
      });
    });

    const first = await createBooking(ids.owner, "CONFIRMED");
    await createBooking(ids.owner, "CANCELLED");
    await createBooking(ids.owner, "DRAFT");
    await createBooking(ids.other, "CONFIRMED");
    await createBooking(null, "CONFIRMED");

    await db.insert(payments).values([
      {
        bookingId: first,
        holdTokenHash: "private-hold-1",
        provider: "test-provider",
        providerPaymentId: randomUUID(),
        paymentCode: randomUUID().replaceAll("-", "").slice(0, 32),
        idempotencyKey: randomUUID(),
        totalAmount: "2700000",
        currency: "VND",
        status: "FAILED",
        createdAt: new Date("2032-01-01T00:00:00Z"),
      },
      {
        bookingId: first,
        holdTokenHash: "private-hold-2",
        provider: "test-provider",
        providerPaymentId: randomUUID(),
        paymentCode: randomUUID().replaceAll("-", "").slice(0, 32),
        idempotencyKey: randomUUID(),
        totalAmount: "2700000",
        currency: "VND",
        status: "PENDING",
        createdAt: new Date("2032-01-02T00:00:00Z"),
      },
    ]);

    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    await app.register(authPlugin);
    await app.register(authRoutes, { prefix: "/api/auth" });
    await app.register(bookingsRoutes, { prefix: "/api" });
    await app.ready();
    ownerCookie = await login(ids.owner);
    otherCookie = await login(ids.other);
    staffCookie = await login(ids.staff);
  });

  afterAll(async () => {
    try {
      await app.close();
      if (!fixtureStarted) return;
      await db.transaction(async (tx) => {
        await tx.delete(payments).where(inArray(payments.bookingId, bookingIds));
        await tx.delete(bookings).where(inArray(bookings.id, bookingIds));
        await tx.delete(facilityUnitTypes).where(eq(facilityUnitTypes.facilityId, ids.facility));
        await tx.delete(facilities).where(eq(facilities.id, ids.facility));
        await tx.delete(unitTypes).where(eq(unitTypes.id, ids.type));
        await tx.delete(checkInSlots).where(eq(checkInSlots.id, ids.slot));
        await tx.delete(users).where(inArray(users.id, [ids.owner, ids.other, ids.staff]));
      });
    } finally {
      await queryClient.end();
    }
  });

  test("lists only owned non-DRAFT bookings once and exposes only the customer DTO", async () => {
    const response = await read("/mine");
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const data = response.json().data;
    expect(data.items).toHaveLength(2);
    expect(data.items.map((item: { status: string }) => item.status).sort()).toEqual([
      "CANCELLED",
      "CONFIRMED",
    ]);
    expect(
      data.items.find((item: { paymentStatus: string }) => item.paymentStatus === "PENDING"),
    ).toMatchObject({
      paymentStatus: "PENDING",
      handoverStage: "WAITING_CUSTOMER",
      pricing: { totalAmount: "2700000.00", currency: "VND" },
    });
    expect(
      data.items.find((item: { status: string }) => item.status === "CANCELLED").paymentStatus,
    ).toBe("NOT_STARTED");
    expect(response.body).not.toContain("private-access-hash");
    expect(response.body).not.toContain("private-qr-hash-");
    expect(response.body).not.toContain("private-hold-");
    expect(response.body).not.toContain("test-provider");
    expect(response.body).not.toContain("@example.test");
    const empty = await read("/mine?status=NO_SHOW");
    expect(empty.statusCode).toBe(200);
    expect(empty.json().data).toEqual({ items: [], nextCursor: null });
  });

  test("paginates equal timestamps without repeating or missing bookings", async () => {
    const tied = await Promise.all(
      Array.from({ length: 3 }, () => createBooking(ids.owner, "CONFIRMED")),
    );
    try {
      const firstPage = await read("/mine?limit=2");
      expect(firstPage.statusCode).toBe(200);
      const firstItems = firstPage.json().data.items;
      const cursor = new URLSearchParams(firstPage.json().data.nextCursor);
      const secondPage = await read(`/mine?${cursor}`);
      expect(secondPage.statusCode).toBe(200);
      const idsOnPages = [...firstItems, ...secondPage.json().data.items].map(
        (item: { id: string }) => item.id,
      );
      expect(idsOnPages).toHaveLength(5);
      expect(new Set(idsOnPages).size).toBe(5);
      expect(new Set(idsOnPages)).toEqual(new Set([...bookingIds.slice(0, 2), ...tied]));
      expect(secondPage.json().data.nextCursor).toBeNull();
    } finally {
      await db.delete(bookings).where(inArray(bookings.id, tied));
      bookingIds.splice(bookingIds.length - tied.length, tied.length);
    }
  });

  test("authorizes customer role and ownership on list and detail without changing staff detail scope", async () => {
    expect((await read("/mine", "")).statusCode).toBe(401);
    expect((await read("/mine", staffCookie)).statusCode).toBe(403);
    expect((await read(`/mine/${bookingIds[0]}`, otherCookie)).statusCode).toBe(404);
    expect((await read(`/mine/${bookingIds.at(-1)}`, ownerCookie)).statusCode).toBe(404);
    expect((await read(`/mine/${bookingIds[0]}`)).statusCode).toBe(200);
    expect((await read(`/mine/${bookingIds[2]}`)).statusCode).toBe(404);
    expect((await read(`/${bookingIds[0]}`)).statusCode).toBe(403);
    expect((await read(`/${bookingIds[0]}`, staffCookie)).statusCode).toBe(200);
    expect((await read("/mine?limit=101")).statusCode).toBe(400);
    expect((await read("/mine?afterId=00000000-0000-4000-8000-000000000000")).statusCode).toBe(400);
  });
});
