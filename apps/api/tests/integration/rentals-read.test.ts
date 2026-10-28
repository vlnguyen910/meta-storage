import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  accounts,
  and,
  bookings,
  checkInSlots,
  db,
  eq,
  facilities,
  facilityAssignments,
  inArray,
  payments,
  queryClient,
  type RentalStatus,
  rentals,
  sql,
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
import { facilitiesRoutes } from "../../src/modules/facilities/facilities.routes";
import { rentalsRoutes } from "../../src/modules/rentals/rentals.routes";
import { ReportsRepository } from "../../src/modules/reports/reports.repository";
import { SupportRepository } from "../../src/modules/support/support.repository";
import { createTestUnitType, deleteTestUnitTypes } from "../fixtures/facility-catalog";
import { assertTestDatabase } from "../fixtures/test-database";

const target = process.env.MY_STORAGE_LOCAL_DATABASE_URL;
const app = Fastify();
const ids = {
  facility: randomUUID(),
  type: randomUUID(),
  unit: randomUUID(),
  slot: randomUUID(),
  owner: randomUUID(),
  other: randomUUID(),
  staff: randomUUID(),
  manager: randomUUID(),
};
const password = "RentalReadTest123!";
const end = "2032-02-01T03:00:00.123456Z";
const active: string[] = [];
const closed: string[] = [];
let foreignRental = "";
let guestRental = "";
let ownerCookie = "";
let staffCookie = "";
let managerCookie = "";
let fixtureStarted = false;
let paidBookingId = "";

async function login(id: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    payload: { email: `${id}@example.test`, password },
  });
  expect(response.statusCode).toBe(200);
  return response.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function createBooking(userId: string | null, status = "CHECKED_IN") {
  const [booking] = await db
    .insert(bookings)
    .values({
      userId,
      facilityId: ids.facility,
      unitTypeId: ids.type,
      checkInSlotId: ids.slot,
      checkInDate: "2032-01-01",
      rentalEndAt: new Date(end),
      requestedMonths: 1,
      monthlyRateSnapshot: "1000000",
      rentalFeeAmount: "1000000",
      depositAmount: "1000000",
      totalAmount: "2000000",
      contactPhone: "0900000000",
      status,
    })
    .returning({ id: bookings.id });
  if (!booking) throw new Error("Missing booking fixture");
  return booking.id;
}

async function createRental(userId: string, status: string, expectedEndAt = end) {
  const bookingId = await createBooking(userId);
  const [rental] = await db
    .insert(rentals)
    .values({
      bookingId,
      userId,
      storageUnitId: ids.unit,
      status: status as RentalStatus,
      startAt: new Date("2032-01-01T03:00:00Z"),
      endAt: new Date(expectedEndAt),
    })
    .returning({ id: rentals.id });
  if (!rental) throw new Error("Missing rental fixture");
  return { id: rental.id, bookingId };
}

function read(url: string, cookie: string = ownerCookie) {
  return app.inject({ method: "GET", url: `/api/rentals${url}`, headers: { cookie } });
}

describe.skipIf(!target)("My Storage reads against existing local container PostgreSQL", () => {
  beforeAll(async () => {
    assertTestDatabase(target, process.env, true);

    const hash = await (await auth.$context).password.hash(password);
    fixtureStarted = true;
    await db.transaction(async (tx) => {
      for (const [id, role] of [
        [ids.owner, "CUSTOMER"],
        [ids.other, "CUSTOMER"],
        [ids.staff, "FACILITY_STAFF"],
        [ids.manager, "FACILITY_MANAGER"],
      ] as const) {
        await tx.insert(users).values({
          id,
          name: "Rental read fixture",
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
          password: hash,
        });
      }
      await tx.insert(facilities).values({
        id: ids.facility,
        code: ids.facility,
        name: "Rental read fixture",
        address: "Local test facility",
      });
      await tx
        .insert(facilityAssignments)
        .values({ userId: ids.manager, facilityId: ids.facility, role: "FACILITY_MANAGER" });
      await createTestUnitType(tx, {
        facilityId: ids.facility,
        id: ids.type,
        code: ids.type,
        name: "Rental read fixture",
        sizeLabel: "S",
        lengthM: 1,
        widthM: 1,
        heightM: 1,
        monthlyPrice: 1000000,
      });

      await tx.insert(storageUnits).values({
        id: ids.unit,
        code: ids.unit,
        facilityId: ids.facility,
        unitTypeId: ids.type,
      });
      await tx.insert(checkInSlots).values({
        id: ids.slot,
        name: "Rental read fixture",
        startTime: "09:00",
        endTime: "10:30",
      });
    });
    for (const status of ["ACTIVE", "ACTIVE", "ACTIVE"]) {
      const rental = await createRental(ids.owner, status);
      active.push(rental.id);
      paidBookingId = rental.bookingId;
    }
    active.sort();
    active.unshift((await createRental(ids.owner, "ACTIVE", "2032-01-20T03:00:00.000Z")).id);
    for (let i = 0; i < 2; i++) closed.push((await createRental(ids.owner, "CLOSED")).id);
    closed.sort();
    foreignRental = (await createRental(ids.other, "ACTIVE")).id;
    guestRental = (await createRental(ids.other, "ACTIVE")).id;
    // Preserve PostgreSQL precision beyond JavaScript Date's millisecond precision.
    await db
      .update(rentals)
      .set({ endAt: sql`${end}::timestamptz` })
      .where(
        and(
          inArray(
            rentals.bookingId,
            db
              .select({ id: bookings.id })
              .from(bookings)
              .where(eq(bookings.facilityId, ids.facility)),
          ),
          eq(rentals.endAt, new Date(end)),
        ),
      );
    await createBooking(ids.owner, "CONFIRMED"); // Paid/confirmed is not yet a rental.
    for (const status of [
      "PENDING",
      "FAILED",
      "SUCCEEDED",
      "REFUND_PENDING",
      "REFUNDED",
    ] as const) {
      const id = randomUUID();
      await db.insert(payments).values({
        id,
        bookingId: paidBookingId,
        holdTokenHash: `private-token-${id}`,
        provider: "mock",
        providerPaymentId: id,
        paymentCode: id.replaceAll("-", ""),
        idempotencyKey: id,
        totalAmount: "2000000",
        currency: "VND",
        status,
        paidAt: ["PENDING", "FAILED"].includes(status) ? null : new Date("2032-01-01T00:00:00Z"),
        refundAmount: ["REFUND_PENDING", "REFUNDED"].includes(status) ? "1000000" : null,
        refundedAt: status === "REFUNDED" ? new Date("2032-01-02T00:00:00Z") : null,
      });
    }
    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    await app.register(authPlugin);
    await app.register(authRoutes, { prefix: "/api/auth" });
    await app.register(rentalsRoutes, { prefix: "/api/rentals" });
    await app.register(facilitiesRoutes, { prefix: "/api/facilities" });
    await app.ready();
    ownerCookie = await login(ids.owner);
    staffCookie = await login(ids.staff);
    managerCookie = await login(ids.manager);
  });

  afterAll(async () => {
    try {
      await app.close();
      if (!fixtureStarted) return;
      await db.transaction(async (tx) => {
        const fixtureBookings = tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(eq(bookings.facilityId, ids.facility));
        await tx.delete(payments).where(inArray(payments.bookingId, fixtureBookings));
        await tx
          .delete(rentals)
          .where(
            inArray(
              rentals.bookingId,
              db
                .select({ id: bookings.id })
                .from(bookings)
                .where(eq(bookings.facilityId, ids.facility)),
            ),
          );
        await tx.delete(bookings).where(eq(bookings.facilityId, ids.facility));
        await tx.delete(storageUnits).where(eq(storageUnits.id, ids.unit));
        await deleteTestUnitTypes(tx, eq(unitTypes.id, ids.type));

        await tx
          .delete(facilityAssignments)
          .where(eq(facilityAssignments.facilityId, ids.facility));
        await tx.delete(facilities).where(eq(facilities.id, ids.facility));
        await tx.delete(checkInSlots).where(eq(checkInSlots.id, ids.slot));
        await tx
          .delete(users)
          .where(inArray(users.id, [ids.owner, ids.other, ids.staff, ids.manager]));
      });
    } finally {
      await queryClient.end();
    }
  });

  test("minimal detail uses the new names and omits removed finance/return fields", async () => {
    const response = await read(`/${active[0]}`);
    expect(response.statusCode).toBe(200);
    const rental = response.json().data;
    expect(rental.userId).toBe(ids.owner);
    expect(rental.storageUnit.id).toBe(ids.unit);
    expect(rental.endAt).toBeDefined();
    for (const field of [
      "physicalUnit",
      "expectedEndAt",
      "version",
      "depositAmount",
      "returnSettlement",
      "actualReturnAt",
      "closedAt",
    ])
      expect(rental).not.toHaveProperty(field);
  });
  test("FM reads only rentals and booking payments of the assigned facility", async () => {
    const request = (path: string, cookie = managerCookie) =>
      app.inject({ method: "GET", url: `/api/facilities/${path}`, headers: { cookie } });
    const list = await request(`${ids.facility}/rentals?status=ACTIVE&limit=2`);
    expect(list.statusCode).toBe(200);
    expect(list.json().data.total).toBe(6);
    expect(list.json().data.items).toHaveLength(2);
    const detail = await request(`${ids.facility}/rentals/${active[0]}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.userId).toBe(ids.owner);
    expect((await request(`${randomUUID()}/rentals`)).statusCode).toBe(403);
    expect((await request(`${ids.facility}/rentals`, staffCookie)).statusCode).toBe(403);
    expect((await request(`${ids.facility}/rentals/${active[0]}/renewals`)).statusCode).toBe(404);
    expect((await request(`${ids.facility}/rentals?status=OVERDUE`)).statusCode).toBe(400);
  });
  test("retained support and report queries do not join retired rental tables", async () => {
    const support = new SupportRepository(db);
    const attempts = await support.contextPayments(ids.owner, paidBookingId, { limit: 20 });
    expect(attempts).toHaveLength(5);
    expect(await support.contextPayments(ids.other, paidBookingId, { limit: 20 })).toHaveLength(0);
    const reports = new ReportsRepository(db),
      actor = { id: ids.manager, role: "FACILITY_MANAGER" as const };
    const periodStart = new Date("2032-01-01T00:00:00Z"),
      periodEnd = new Date("2032-02-01T00:00:00Z"),
      asOf = new Date("2032-02-02T00:00:00Z");
    const data = await reports.read(
      actor,
      { facilityId: ids.facility },
      periodStart,
      periodEnd,
      asOf,
    );
    expect(data).not.toHaveProperty("chargePayments");
    expect(data).not.toHaveProperty("chargeRefunds");
    expect(data.financial.length).toBeGreaterThan(0);
    const monthly = await reports.monthlyRevenue(
      actor,
      { facilityId: ids.facility },
      periodStart,
      periodEnd,
      asOf,
    );
    expect(monthly.receipts.length).toBeGreaterThan(0);
    const rentals = await reports.rentalReport(actor, {
      facilityId: ids.facility,
      limit: 20,
      offset: 0,
    });
    expect(rentals.total).toBe(8);
  });

  test("database rejects duplicate booking rentals and invalid rental periods", async () => {
    const id = active[0];
    if (!id) throw new Error("Missing rental fixture");
    const [rental] = await db.select().from(rentals).where(eq(rentals.id, id));
    if (!rental) throw new Error("Missing rental fixture");
    const { id: _id, ...values } = rental;
    await expect(db.insert(rentals).values(values).execute()).rejects.toThrow();
    await expect(
      db.update(rentals).set({ endAt: rental.startAt }).where(eq(rentals.id, rental.id)).execute(),
    ).rejects.toThrow();
  });

  test("default list is paginated current view and excludes closed/unhanded-over/guest/other rentals", async () => {
    const response = await read("/mine");
    expect(response.statusCode).toBe(200);
    expect(response.json().data.items.map((item: { id: string }) => item.id)).toEqual(active);
    expect(response.body).not.toContain("private-booking-hash");
    expect(
      response
        .json()
        .data.items.map((item: { status: string }) => item.status)
        .sort(),
    ).toEqual(["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE"]);
  });

  test("current pagination is stable for equal expiry dates and does not require cursor row", async () => {
    const first = await read("/mine?limit=2");
    expect(first.statusCode).toBe(200);
    expect(first.json().data.items.map((item: { id: string }) => item.id)).toEqual(
      active.slice(0, 2),
    );
    const next = new URLSearchParams({ ...first.json().data.nextCursor, limit: "2" });
    const second = await read(`/mine?${next}`);
    expect(second.statusCode).toBe(200);
    expect(second.json().data.items.map((item: { id: string }) => item.id)).toEqual(
      active.slice(2),
    );
    expect(second.json().data.nextCursor).toBeNull();

    // A tuple cursor need not identify an existing row; ownership remains in the SQL predicate.
    const later = await read(
      `/mine?afterEndAt=${encodeURIComponent(end)}&afterId=ffffffff-ffff-4fff-bfff-ffffffffffff`,
    );
    expect(later.statusCode).toBe(200);
    expect(later.json().data.items).toEqual([]);
  });

  test("history is independently paginated and closed rentals remain readable by owner", async () => {
    const first = await read("/mine?view=history&limit=1");
    expect(first.statusCode).toBe(200);
    expect(first.json().data.items.map((item: { id: string }) => item.id)).toEqual(
      closed.slice(0, 1),
    );
    const cursor = new URLSearchParams({
      ...first.json().data.nextCursor,
      limit: "1",
      view: "history",
    });
    const second = await read(`/mine?${cursor}`);
    expect(second.statusCode).toBe(200);
    expect(second.json().data.items.map((item: { id: string }) => item.id)).toEqual(
      closed.slice(1),
    );
    expect(second.json().data.nextCursor).toBeNull();
    expect((await read(`/${closed[0]}`)).statusCode).toBe(200);
  });

  test("auth, role, ownership and query validation apply on every read endpoint", async () => {
    for (const path of [
      "/mine",
      "/mine?view=current",
      "/mine?view=history",
      `/${active[0]}/payments`,
    ]) {
      expect((await read(path, "")).statusCode).toBe(401);
      expect((await read(path, staffCookie)).statusCode).toBe(403);
    }
    for (const id of [foreignRental, guestRental, randomUUID()]) {
      expect((await read(`/${id}`)).statusCode).toBe(404);
      expect((await read(`/${id}/payments`)).statusCode).toBe(404);
    }
    for (const query of [
      "view=invalid",
      "view=",
      "view=current&view=history",
      "limit=0",
      "limit=101",
      "limit=1.5",
      "afterId=bad",
      `afterEndAt=${end}`,
      `afterId=${active[0]}`,
    ])
      expect((await read(`/mine?${query}`)).statusCode).toBe(400);
    expect((await read("/not-a-uuid/payments")).statusCode).toBe(400);
  });

  test("default limit is 20 and Load More traverses the current view without duplicates", async () => {
    const extra: { id: string; bookingId: string }[] = [];
    try {
      for (let i = 0; i < 21; i++)
        extra.push(await createRental(ids.owner, "ACTIVE", "2032-03-01T03:00:00Z"));
      const first = await read("/mine");
      expect(first.statusCode).toBe(200);
      expect(first.json().data.items).toHaveLength(20);
      expect(first.json().data.nextCursor).not.toBeNull();
      const cursor = new URLSearchParams(first.json().data.nextCursor);
      const second = await read(`/mine?${cursor}`);
      expect(second.statusCode).toBe(200);
      expect(second.json().data.items).toHaveLength(5);
      expect(second.json().data.nextCursor).toBeNull();
      const listedIds = [...first.json().data.items, ...second.json().data.items].map(
        (r: { id: string }) => r.id,
      );
      expect(new Set(listedIds).size).toBe(25);
      expect(listedIds).toEqual([...active, ...extra.map((r) => r.id).sort()]);
    } finally {
      if (extra.length)
        await db.transaction(async (tx) => {
          await tx.delete(rentals).where(
            inArray(
              rentals.id,
              extra.map((r) => r.id),
            ),
          );
          await tx.delete(bookings).where(
            inArray(
              bookings.id,
              extra.map((r) => r.bookingId),
            ),
          );
        });
    }
  });

  test("payment history preserves pending/failed/refund facts without credential disclosure", async () => {
    const [rental] = await db
      .select({ id: rentals.id })
      .from(rentals)
      .where(eq(rentals.bookingId, paidBookingId));
    if (!rental) throw new Error("Missing paid rental");
    const response = await read(`/${rental.id}/payments`);
    expect(response.statusCode).toBe(200);
    const items = response.json().data;
    expect(items).toHaveLength(5);
    expect(items.map((item: { status: string }) => item.status).sort()).toEqual([
      "FAILED",
      "PENDING",
      "REFUNDED",
      "REFUND_PENDING",
      "SUCCEEDED",
    ]);
    for (const item of items) {
      expect(item.totalAmount).toBe("2000000.00");
      if (["FAILED", "PENDING"].includes(item.status)) expect(item.paidAt).toBeNull();
      if (["REFUNDED", "REFUND_PENDING"].includes(item.status))
        expect(item.refundAmount).toBe("1000000.00");
      expect(item).not.toHaveProperty("holdTokenHash");
      expect(item).not.toHaveProperty("idempotencyKey");
      expect(item).not.toHaveProperty("providerPaymentId");
    }
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect((await read(`/${closed[0]}/payments`)).json().data).toEqual([]);
  });
});
