import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import {
  bookings,
  capacityAllocations,
  checkInSlots,
  db,
  eq,
  facilities,
  facilityUnitTypes,
  inArray,
  payments,
  reservationDrafts,
  storageUnits,
  unitAssignments,
  unitTypes,
  users,
} from "@metastorage/database";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { env } from "../../src/config/env";
import { bookingsRoutes } from "../../src/modules/bookings/bookings.routes";
import { paymentsRoutes } from "../../src/modules/payments/payments.routes";

const testUrl = process.env.BOOKING_TEST_DATABASE_URL;
const ids = {
  facility: randomUUID(),
  type: randomUUID(),
  unit: randomUUID(),
  extraUnit: randomUUID(),
  slot: randomUUID(),
  user: randomUUID(),
};
const contact = { fullName: "Payment guest", email: "guest@example.test", phone: "+84901234567" };
const checkInDate = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
const app = Fastify();
const previous = {
  provider: env.PAYMENT_PROVIDER,
  merchant: env.SEPAY_MERCHANT_ID,
  secret: env.SEPAY_SECRET_KEY,
};
let created = false;

async function clearBookings() {
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.facilityId, ids.facility));
  if (rows.length)
    await db.delete(payments).where(
      inArray(
        payments.bookingId,
        rows.map((row) => row.id),
      ),
    );
  await db.delete(capacityAllocations).where(eq(capacityAllocations.facilityId, ids.facility));
  await db.delete(bookings).where(eq(bookings.facilityId, ids.facility));
}

async function draft() {
  const response = await app.inject({
    method: "POST",
    url: "/api/bookings/drafts",
    payload: {
      facilityId: ids.facility,
      unitTypeId: ids.type,
      checkInSlotId: ids.slot,
      checkInDate,
      durationMonths: 2,
    },
  });
  expect(response.statusCode).toBe(201);
  return response.json().data as {
    id: string;
    draftAccessToken: string;
    rentalEndAt: string;
    checkInAt: string;
  };
}

function pay(
  booking: { id: string; draftAccessToken: string },
  key = randomUUID(),
  extra: Record<string, unknown> = {},
) {
  return app.inject({
    method: "POST",
    url: `/api/bookings/${booking.id}/pay`,
    payload: {
      draftAccessToken: booking.draftAccessToken,
      idempotencyKey: key,
      contact,
      ...extra,
    },
  });
}

describe.skipIf(!testUrl)("Start booking payment with isolated PostgreSQL", () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== testUrl)
      throw new Error("Use the isolated BOOKING_TEST_DATABASE_URL");
    env.PAYMENT_PROVIDER = "sepay";
    env.SEPAY_MERCHANT_ID = "test-merchant";
    env.SEPAY_SECRET_KEY = "test-only-sepay-secret";
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: ids.user,
        name: "Saved booking owner",
        email: `${ids.user}@example.test`,
        role: "CUSTOMER",
        status: "ACTIVE",
      });
      await tx
        .insert(facilities)
        .values({ id: ids.facility, code: ids.facility, name: "Payment test", address: "Test" });
      await tx.insert(unitTypes).values({
        id: ids.type,
        code: ids.type,
        name: "Payment type",
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
        .values({ id: ids.slot, name: "Payment slot", startTime: "09:00", endTime: "10:00" });
    });
    created = true;
    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    await app.register(bookingsRoutes, { prefix: "/api" });
    await app.register(paymentsRoutes, { prefix: "/api" });
    await app.ready();
  });

  beforeEach(async () => {
    await clearBookings();
    await db.delete(storageUnits).where(eq(storageUnits.id, ids.extraUnit));
    await db
      .update(unitTypes)
      .set({ monthlyPrice: 1000000, isActive: true })
      .where(eq(unitTypes.id, ids.type));
    await db.update(facilities).set({ isActive: true }).where(eq(facilities.id, ids.facility));
    await db.update(storageUnits).set({ status: "AVAILABLE" }).where(eq(storageUnits.id, ids.unit));
  });

  afterAll(async () => {
    await app.close();
    env.PAYMENT_PROVIDER = previous.provider;
    env.SEPAY_MERCHANT_ID = previous.merchant;
    env.SEPAY_SECRET_KEY = previous.secret;
    if (!created) return;
    await clearBookings();
    await db.delete(storageUnits).where(eq(storageUnits.id, ids.extraUnit));
    await db.delete(storageUnits).where(eq(storageUnits.id, ids.unit));
    await db.delete(facilityUnitTypes).where(eq(facilityUnitTypes.facilityId, ids.facility));
    await db.delete(facilities).where(eq(facilities.id, ids.facility));
    await db.delete(unitTypes).where(eq(unitTypes.id, ids.type));
    await db.delete(checkInSlots).where(eq(checkInSlots.id, ids.slot));
    await db.delete(users).where(eq(users.id, ids.user));
  });

  test("starts SePay checkout on the same draft with snapshotted price, contact and a ten-minute hold", async () => {
    const booking = await draft();
    await db.update(bookings).set({ userId: ids.user }).where(eq(bookings.id, booking.id));
    const reservationsBefore = await db.select().from(reservationDrafts);
    await db.update(unitTypes).set({ monthlyPrice: 2000000 }).where(eq(unitTypes.id, ids.type));
    const start = Date.now();
    const response = await pay(booking, "x".repeat(128), {
      totalAmount: "1",
      userId: randomUUID(),
      status: "SUCCEEDED",
    });
    expect(response.statusCode).toBe(201);
    const data = response.json().data;
    expect(data).toMatchObject({ bookingId: booking.id, status: "PENDING", provider: "sepay" });
    expect(data.checkoutUrl).toStartWith("https://");
    expect(Number(data.checkoutFormFields.order_amount)).toBe(3000000);
    for (const [field, status] of [
      ["success_url", "success"],
      ["error_url", "error"],
      ["cancel_url", "cancel"],
    ]) {
      const url = new URL(data.checkoutFormFields[field]);
      expect(url.pathname).toBe("/bookings/payment-result");
      expect(url.searchParams.get("bookingId")).toBe(booking.id);
      expect(url.searchParams.get("paymentId")).toBe(data.paymentId);
      expect(url.searchParams.get("status")).toBe(status);
      expect(url.searchParams.has("draftId")).toBe(false);
    }
    expect(data.holdTokenHash).toBeUndefined();
    expect(data.draftAccessToken).toBeUndefined();
    const [payment] = await db.select().from(payments).where(eq(payments.id, data.paymentId));
    expect(payment).toMatchObject({
      bookingId: booking.id,
      draftId: null,
      status: "PENDING",
      paidAt: null,
      totalAmount: "3000000.00",
      currency: "VND",
    });
    const [saved] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(saved).toMatchObject({
      status: "DRAFT",
      userId: ids.user,
      bookingCode: null,
      qrTokenHash: null,
      contactName: contact.fullName,
      contactEmail: contact.email,
      contactPhone: contact.phone,
    });
    const holds = await db
      .select()
      .from(capacityAllocations)
      .where(eq(capacityAllocations.referenceId, booking.id));
    expect(holds).toHaveLength(1);
    expect(holds[0]).toMatchObject({
      kind: "HOLD",
      status: "ACTIVE",
      startsAt: new Date(booking.checkInAt),
      endsAt: new Date(booking.rentalEndAt),
      accessTokenHash: payment?.holdTokenHash,
    });
    expect(Date.parse(data.expiresAt)).toBeGreaterThanOrEqual(start + 600000);
    expect(Date.parse(data.expiresAt)).toBeLessThanOrEqual(Date.now() + 600000);
    expect(await db.select().from(reservationDrafts)).toEqual(reservationsBefore);
  });

  test("concurrent same-key retries reuse payment and hold without extending expiry", async () => {
    const booking = await draft();
    const key = randomUUID();
    const responses = await Promise.all(Array.from({ length: 4 }, () => pay(booking, key)));
    expect(responses.map((r) => r.statusCode)).toEqual([201, 201, 201, 201]);
    expect(new Set(responses.map((r) => r.json().data.paymentId)).size).toBe(1);
    expect(new Set(responses.map((r) => r.json().data.expiresAt)).size).toBe(1);
    const rows = await db
      .select()
      .from(capacityAllocations)
      .where(eq(capacityAllocations.referenceId, booking.id));
    expect(rows).toHaveLength(1);
    const shortened = new Date(Date.now() + 300000);
    await db
      .update(capacityAllocations)
      .set({ expiresAt: shortened })
      .where(eq(capacityAllocations.id, rows[0]?.id as string));
    const replay = await pay(booking, key);
    expect(replay.statusCode).toBe(201);
    expect(replay.json().data.expiresAt).toBe(shortened.toISOString());
    expect(await db.select().from(payments).where(eq(payments.bookingId, booking.id))).toHaveLength(
      1,
    );
  });

  test("payment status rebuilds only a booking checkout with an active hold", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    const response = await app.inject({
      method: "GET",
      url: `/api/payments/${payment.paymentId}/status`,
    });
    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.checkoutUrl).toBe(payment.checkoutUrl);
    expect(data.checkoutFormFields).toEqual(payment.checkoutFormFields);
    await db
      .update(capacityAllocations)
      .set({ expiresAt: new Date(0) })
      .where(eq(capacityAllocations.referenceId, booking.id));
    const expired = await app.inject({
      method: "GET",
      url: `/api/payments/${payment.paymentId}/status`,
    });
    expect(expired.statusCode).toBe(200);
    expect(expired.json().data.checkoutUrl).toBeUndefined();
    expect(expired.json().data.checkoutFormFields).toBeUndefined();
  });

  test("rejects another checkout reusing the idempotency key without persisting contact or hold", async () => {
    const first = await draft();
    const second = await draft();
    const key = randomUUID();
    expect((await pay(first, key)).statusCode).toBe(201);
    expect((await pay(second, key)).statusCode).toBe(409);
    expect(
      await db
        .select()
        .from(capacityAllocations)
        .where(eq(capacityAllocations.referenceId, second.id)),
    ).toHaveLength(0);
    expect(
      (await db.select().from(bookings).where(eq(bookings.id, second.id)))[0]?.contactEmail,
    ).toBeNull();
  });

  test("two drafts competing for the final unit produce one payment and one hold", async () => {
    const first = await draft();
    const second = await draft();
    const responses = await Promise.all([pay(first), pay(second)]);
    expect(responses.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(
      await db
        .select()
        .from(payments)
        .where(inArray(payments.bookingId, [first.id, second.id])),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(capacityAllocations)
        .where(eq(capacityAllocations.facilityId, ids.facility)),
    ).toHaveLength(1);
  });

  test("wrong draft token cannot start payment", async () => {
    const booking = await draft();
    expect(
      (await pay(booking, randomUUID(), { draftAccessToken: "a".repeat(64) })).statusCode,
    ).toBe(404);
    expect(await db.select().from(payments).where(eq(payments.bookingId, booking.id))).toHaveLength(
      0,
    );
    expect(
      (await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0]?.accessTokenHash,
    ).toBe(createHash("sha256").update(booking.draftAccessToken).digest("hex"));
  });

  test("expired hold cannot be revived through retries or a new idempotency key", async () => {
    const booking = await draft();
    const key = randomUUID();
    expect((await pay(booking, key)).statusCode).toBe(201);
    await db
      .update(capacityAllocations)
      .set({ expiresAt: new Date(0) })
      .where(eq(capacityAllocations.referenceId, booking.id));
    expect((await pay(booking, key)).statusCode).toBe(409);
    expect((await pay(booking)).statusCode).toBe(409);
    expect(await db.select().from(payments).where(eq(payments.bookingId, booking.id))).toHaveLength(
      1,
    );
  });

  test("a different key cannot create a second pending payment for the booking", async () => {
    const booking = await draft();
    expect((await pay(booking)).statusCode).toBe(201);
    expect((await pay(booking)).statusCode).toBe(409);
    expect(await db.select().from(payments).where(eq(payments.bookingId, booking.id))).toHaveLength(
      1,
    );
  });

  test("same-key replay cannot overwrite the original checkout contact", async () => {
    const booking = await draft();
    const key = randomUUID();
    expect((await pay(booking, key)).statusCode).toBe(201);
    expect(
      (await pay(booking, key, { contact: { ...contact, email: "other@example.test" } }))
        .statusCode,
    ).toBe(409);
    expect(
      (await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0]?.contactEmail,
    ).toBe(contact.email);
  });

  test("non-DRAFT bookings cannot start another checkout", async () => {
    const booking = await draft();
    await db
      .update(bookings)
      .set({
        status: "CONFIRMED",
        contactName: contact.fullName,
        contactEmail: contact.email,
        contactPhone: contact.phone,
      })
      .where(eq(bookings.id, booking.id));
    expect((await pay(booking)).statusCode).toBe(409);
    expect(await db.select().from(payments).where(eq(payments.bookingId, booking.id))).toHaveLength(
      0,
    );
  });

  test.each([
    "RESERVED",
    "OCCUPIED",
    "INSPECTION",
    "RETURN_PENDING",
    "INACTIVE",
    "LOCKED",
    "MAINTENANCE",
  ] as const)("revalidates inventory when the unit becomes %s after drafting", async (status) => {
    const booking = await draft();
    await db.update(storageUnits).set({ status }).where(eq(storageUnits.id, ids.unit));
    expect((await pay(booking)).statusCode).toBe(409);
    expect(
      await db
        .select()
        .from(capacityAllocations)
        .where(eq(capacityAllocations.referenceId, booking.id)),
    ).toHaveLength(0);
    expect(
      (await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0]?.contactEmail,
    ).toBeNull();
  });

  test.each([false, true])(
    "uses peak concurrent occupancy for sequential allocations (overlapping: %s)",
    async (overlapping) => {
      const booking = await draft();
      await db.insert(storageUnits).values({
        id: ids.extraUnit,
        code: ids.extraUnit,
        facilityId: ids.facility,
        unitTypeId: ids.type,
      });
      const start = new Date(booking.checkInAt);
      const end = new Date(booking.rentalEndAt);
      const middle = new Date((start.getTime() + end.getTime()) / 2);
      await db.insert(capacityAllocations).values([
        {
          facilityId: ids.facility,
          unitTypeId: ids.type,
          referenceId: randomUUID(),
          kind: "BOOKING",
          status: "ACTIVE",
          startsAt: start,
          endsAt: middle,
        },
        {
          facilityId: ids.facility,
          unitTypeId: ids.type,
          referenceId: randomUUID(),
          kind: "HOLD",
          status: "ACTIVE",
          startsAt: overlapping ? new Date(middle.getTime() - 1) : middle,
          endsAt: end,
          expiresAt: new Date(Date.now() + 600000),
        },
      ]);
      const draftResponse = await app.inject({
        method: "POST",
        url: "/api/bookings/drafts",
        payload: {
          facilityId: ids.facility,
          unitTypeId: ids.type,
          checkInSlotId: ids.slot,
          checkInDate,
          durationMonths: 2,
        },
      });
      expect(draftResponse.statusCode).toBe(overlapping ? 409 : 201);
      expect((await pay(booking)).statusCode).toBe(overlapping ? 409 : 201);
      expect(
        await db.select().from(payments).where(eq(payments.bookingId, booking.id)),
      ).toHaveLength(overlapping ? 0 : 1);
    },
  );

  test("ignores allocations outside the rental period and allocations no longer active", async () => {
    const booking = await draft();
    const start = new Date(booking.checkInAt);
    const end = new Date(booking.rentalEndAt);
    await db.insert(capacityAllocations).values([
      {
        facilityId: ids.facility,
        unitTypeId: ids.type,
        referenceId: randomUUID(),
        kind: "BOOKING",
        status: "ACTIVE",
        startsAt: new Date(start.getTime() - 86400000),
        endsAt: start,
      },
      {
        facilityId: ids.facility,
        unitTypeId: ids.type,
        referenceId: randomUUID(),
        kind: "BOOKING",
        status: "ACTIVE",
        startsAt: end,
        endsAt: new Date(end.getTime() + 86400000),
      },
      {
        facilityId: ids.facility,
        unitTypeId: ids.type,
        referenceId: randomUUID(),
        kind: "HOLD",
        status: "RELEASED",
        startsAt: start,
        endsAt: end,
      },
      {
        facilityId: ids.facility,
        unitTypeId: ids.type,
        referenceId: randomUUID(),
        kind: "HOLD",
        status: "EXPIRED",
        startsAt: start,
        endsAt: end,
      },
    ]);
    await draft();
    expect((await pay(booking)).statusCode).toBe(201);
  });

  test.each([false, true])(
    "requires one AVAILABLE unit for the full period when bookings are already assigned (same unit: %s)",
    async (sameUnit) => {
      await db.insert(storageUnits).values({
        id: ids.extraUnit,
        code: ids.extraUnit,
        facilityId: ids.facility,
        unitTypeId: ids.type,
      });
      const first = await draft();
      const second = await draft();
      const candidate = await draft();
      const start = new Date(first.checkInAt);
      const middle = new Date(start.getTime() + 30 * 86400000);
      const end = new Date(first.rentalEndAt);
      await db
        .update(bookings)
        .set({
          status: "CONFIRMED",
          contactName: contact.fullName,
          contactEmail: contact.email,
          contactPhone: contact.phone,
          rentalEndAt: middle,
        })
        .where(eq(bookings.id, first.id));
      await db
        .update(bookings)
        .set({
          status: "CONFIRMED",
          contactName: contact.fullName,
          contactEmail: contact.email,
          contactPhone: contact.phone,
          checkInDate: middle.toISOString().slice(0, 10),
        })
        .where(eq(bookings.id, second.id));
      await db.insert(unitAssignments).values([
        { bookingId: first.id, physicalUnitId: ids.unit, assignedBy: ids.user },
        {
          bookingId: second.id,
          physicalUnitId: sameUnit ? ids.unit : ids.extraUnit,
          assignedBy: ids.user,
        },
      ]);
      await db.insert(capacityAllocations).values([
        {
          facilityId: ids.facility,
          unitTypeId: ids.type,
          referenceId: first.id,
          kind: "BOOKING",
          status: "ACTIVE",
          startsAt: start,
          endsAt: middle,
        },
        {
          facilityId: ids.facility,
          unitTypeId: ids.type,
          referenceId: second.id,
          kind: "BOOKING",
          status: "ACTIVE",
          startsAt: middle,
          endsAt: end,
        },
      ]);
      const expected = sameUnit ? 201 : 409;
      if (sameUnit) await draft();
      else {
        const response = await app.inject({
          method: "POST",
          url: "/api/bookings/drafts",
          payload: {
            facilityId: ids.facility,
            unitTypeId: ids.type,
            checkInSlotId: ids.slot,
            checkInDate,
            durationMonths: 2,
          },
        });
        expect(response.statusCode).toBe(expected);
      }
      expect((await pay(candidate)).statusCode).toBe(expected);
    },
  );

  test("does not subtract an assigned RESERVED unit again from AVAILABLE inventory", async () => {
    await db.insert(storageUnits).values({
      id: ids.extraUnit,
      code: ids.extraUnit,
      facilityId: ids.facility,
      unitTypeId: ids.type,
    });
    const assigned = await draft();
    const candidate = await draft();
    await db
      .update(bookings)
      .set({
        status: "CONFIRMED",
        contactName: contact.fullName,
        contactEmail: contact.email,
        contactPhone: contact.phone,
      })
      .where(eq(bookings.id, assigned.id));
    await db.insert(unitAssignments).values({
      bookingId: assigned.id,
      physicalUnitId: ids.unit,
      assignedBy: ids.user,
    });
    await db.update(storageUnits).set({ status: "RESERVED" }).where(eq(storageUnits.id, ids.unit));
    await db.insert(capacityAllocations).values({
      facilityId: ids.facility,
      unitTypeId: ids.type,
      referenceId: assigned.id,
      kind: "BOOKING",
      status: "ACTIVE",
      startsAt: new Date(assigned.checkInAt),
      endsAt: new Date(assigned.rentalEndAt),
    });
    await draft();
    expect((await pay(candidate)).statusCode).toBe(201);
  });

  test("expired holds from another checkout do not consume capacity", async () => {
    const booking = await draft();
    await db.insert(capacityAllocations).values({
      facilityId: ids.facility,
      unitTypeId: ids.type,
      referenceId: randomUUID(),
      kind: "HOLD",
      status: "ACTIVE",
      startsAt: new Date(booking.checkInAt),
      endsAt: new Date(booking.rentalEndAt),
      expiresAt: new Date(0),
    });
    expect((await pay(booking)).statusCode).toBe(201);
  });

  test("missing SePay PG credentials return 503 without reserving capacity or saving contact", async () => {
    const booking = await draft();
    const merchant = env.SEPAY_MERCHANT_ID;
    const secret = env.SEPAY_SECRET_KEY;
    const unavailable = Fastify();
    try {
      env.SEPAY_MERCHANT_ID = undefined;
      env.SEPAY_SECRET_KEY = undefined;
      unavailable.decorate("db", db);
      unavailable.setValidatorCompiler(validatorCompiler);
      unavailable.setSerializerCompiler(serializerCompiler);
      setupErrorHandler(unavailable);
      await unavailable.register(bookingsRoutes, { prefix: "/api" });
      const response = await unavailable.inject({
        method: "POST",
        url: `/api/bookings/${booking.id}/pay`,
        payload: {
          draftAccessToken: booking.draftAccessToken,
          contact,
          idempotencyKey: randomUUID(),
        },
      });
      expect(response.statusCode).toBe(503);
      expect(
        await db
          .select()
          .from(capacityAllocations)
          .where(eq(capacityAllocations.referenceId, booking.id)),
      ).toHaveLength(0);
      expect(
        (await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0]?.contactEmail,
      ).toBeNull();
    } finally {
      env.SEPAY_MERCHANT_ID = merchant;
      env.SEPAY_SECRET_KEY = secret;
      await unavailable.close();
    }
  });

  test.each([
    { contact: undefined },
    { contact: { ...contact, email: "invalid" } },
    { draftAccessToken: "invalid" },
    { idempotencyKey: "short" },
  ])("invalid input is rejected before persistence: %j", async (extra) => {
    const booking = await draft();
    expect((await pay(booking, randomUUID(), extra)).statusCode).toBe(400);
    expect(await db.select().from(payments).where(eq(payments.bookingId, booking.id))).toHaveLength(
      0,
    );
  });
});
