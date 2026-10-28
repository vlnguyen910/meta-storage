import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { bookings, checkInSlots, db, eq, payments, rentals, users } from "@metastorage/database";
import { facilityWorkspaceRoutes } from "../../src/modules/facility-workspace/facility-workspace.routes";
import { createFacilityOperationsFixture } from "../fixtures/facility-operations";

describe.skipIf(!process.env.MY_STORAGE_LOCAL_DATABASE_URL)("FM facility workspace", () => {
  let f: Awaited<ReturnType<typeof createFacilityOperationsFixture>>;
  const bookingId = randomUUID(),
    rentalId = randomUUID(),
    slotId = randomUUID(),
    paymentId = randomUUID();
  beforeAll(async () => {
    f = await createFacilityOperationsFixture();
    await db.update(users).set({ name: "Khách đang thuê" }).where(eq(users.id, f.ids.customer));
    await f.app.register(facilityWorkspaceRoutes, { prefix: "/api/facility-workspace" });
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
      facilityId: f.facilityId,
      physicalUnitId: f.unitId,
      status: "ACTIVE",
      startAt: new Date("2026-10-27"),
      expectedEndAt: new Date("2026-11-27"),
      depositAmount: "1000000",
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
    const list = await f.api(
      "manager",
      "GET",
      `/facility-workspace/rentals?facilityId=${f.facilityId}`,
    );
    expect(list.statusCode, list.body).toBe(200);
    expect(list.json().data.items[0]).toMatchObject({
      id: rentalId,
      customerName: "Khách đang thuê",
      status: "ACTIVE",
    });
    const detail = await f.api("manager", "GET", `/facility-workspace/rentals/${rentalId}`);
    expect(detail.json().data.payments[0]).toMatchObject({ id: paymentId, status: "SUCCEEDED" });
    expect(
      (await f.api("otherManager", "GET", `/facility-workspace/rentals/${rentalId}`)).statusCode,
    ).toBe(404);
    expect(
      (await f.api("otherManager", "GET", `/facility-workspace/rentals?facilityId=${f.facilityId}`))
        .statusCode,
    ).toBe(403);
    expect(
      (await f.api("staff", "GET", `/facility-workspace/rentals?facilityId=${f.facilityId}`))
        .statusCode,
    ).toBe(403);
  });
});
