import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { bookings, checkInSlots, db, eq, payments, rentals, users } from "@metastorage/database";
import { rentalsRoutes } from "../../src/modules/rentals/rentals.routes";
import { createFacilityOperationsFixture } from "../fixtures/facility-operations";

describe.skipIf(!process.env.MY_STORAGE_LOCAL_DATABASE_URL)("FM rental workspace", () => {
  let f: Awaited<ReturnType<typeof createFacilityOperationsFixture>>;
  const bookingId = randomUUID(),
    rentalId = randomUUID(),
    slotId = randomUUID(),
    paymentId = randomUUID();
  beforeAll(async () => {
    f = await createFacilityOperationsFixture();
    await db.update(users).set({ name: "Khách đang thuê" }).where(eq(users.id, f.ids.customer));
    await f.app.register(rentalsRoutes, { prefix: "/api/rentals" });
    await db
      .insert(checkInSlots)
      .values({ id: slotId, name: "FM workspace", startTime: "09:00", endTime: "10:00" });
    await db.insert(bookings).values({
      id: bookingId,
      bookingCode: `FM-${bookingId.slice(0, 8)}`,
      contactPhone: "0901234567",
      userId: f.ids.customer,
      facilityId: f.facilityId,
      unitTypeId: f.typeId,
      requestedMonths: 1,
      checkInDate: "2026-10-27",
      checkInSlotId: slotId,
      rentalEndAt: new Date("2026-11-27T00:00:00Z"),
      monthlyRateSnapshot: "1000000",
      rentalFeeAmount: "1000000",
      depositAmount: "1000000",
      totalAmount: "2000000",
      status: "CHECKED_IN",
    });
    await db.insert(rentals).values({
      id: rentalId,
      bookingId,
      userId: f.ids.customer,
      storageUnitId: f.unitId,
      status: "ACTIVE",
      startAt: new Date("2026-10-27"),
      endAt: new Date("2026-11-27"),
    });
    await db.insert(payments).values({
      id: paymentId,
      bookingId,
      holdTokenHash: "workspace-test",
      provider: "mock",
      paymentCode: paymentId.slice(0, 32),
      providerPaymentId: paymentId,
      idempotencyKey: paymentId,
      totalAmount: "2000000",
      currency: "VND",
      status: "SUCCEEDED",
      paidAt: new Date(),
    });
    await f.login();
  });
  afterAll(async () => {
    if (!f) return;
    await db.delete(payments).where(eq(payments.id, paymentId));
    await db.delete(rentals).where(eq(rentals.id, rentalId));
    await db.delete(bookings).where(eq(bookings.id, bookingId));
    await db.delete(checkInSlots).where(eq(checkInSlots.id, slotId));
    await f.cleanup();
  });
  test("rental customers and payment history are restricted to the assigned FM", async () => {
    const list = await f.api("manager", "GET", `/rentals/facility/${f.facilityId}`);
    expect(list.statusCode, list.body).toBe(200);
    expect(list.json().data.items[0]).toMatchObject({
      id: rentalId,
      customer: { name: "Khách đang thuê" },
      status: "ACTIVE",
    });
    const detail = await f.api(
      "manager",
      "GET",
      `/rentals/facility/${f.facilityId}/${rentalId}/payments`,
    );
    expect(detail.json().data.items[0]).toMatchObject({ id: paymentId, status: "SUCCEEDED" });
    expect(
      (await f.api("otherManager", "GET", `/rentals/facility/${f.facilityId}/${rentalId}`))
        .statusCode,
    ).toBe(403);
    expect(
      (await f.api("otherManager", "GET", `/rentals/facility/${f.facilityId}`)).statusCode,
    ).toBe(403);
    expect((await f.api("staff", "GET", `/rentals/facility/${f.facilityId}`)).statusCode).toBe(403);
  });
});
