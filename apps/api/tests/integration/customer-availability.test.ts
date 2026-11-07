import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  bookings,
  capacityAllocations,
  checkInSlots,
  db,
  eq,
  queryClient,
  storageUnits,
  unitAssignments,
} from "@metastorage/database";
import { facilitiesRoutes } from "../../src/modules/facilities/facilities.routes";
import { createFacilityOperationsFixture } from "../fixtures/facility-operations";

describe.skipIf(!process.env.MY_STORAGE_LOCAL_DATABASE_URL)("Public period availability", () => {
  let f: Awaited<ReturnType<typeof createFacilityOperationsFixture>>;
  const slotId = randomUUID();
  const bookingId = randomUUID();
  const extraUnitId = randomUUID();
  const start = new Date("2034-02-01T02:00:00Z");
  const end = new Date("2034-03-03T02:00:00Z");
  const read = (extra = "") =>
    f.api(
      null,
      "GET",
      `/facilities/${f.facilityId}/availability?unitTypeId=${f.typeId}&checkInDate=2034-02-01&checkInSlotId=${slotId}&durationMonths=1${extra}`,
    );
  beforeAll(async () => {
    f = await createFacilityOperationsFixture();
    await f.app.register(facilitiesRoutes, { prefix: "/api/facilities" });
    await db
      .insert(checkInSlots)
      .values({ id: slotId, name: "Period availability", startTime: "09:00", endTime: "10:00" });
    await f.login();
  });
  afterAll(async () => {
    if (f) {
      await db.delete(unitAssignments).where(eq(unitAssignments.bookingId, bookingId));
      await db.delete(capacityAllocations).where(eq(capacityAllocations.facilityId, f.facilityId));
      await db.delete(bookings).where(eq(bookings.id, bookingId));
      await db.delete(checkInSlots).where(eq(checkInSlots.id, slotId));
      await db.delete(storageUnits).where(eq(storageUnits.id, extraUnitId));
      await f.cleanup();
    }
    await queryClient.end();
  });
  test("anonymous snapshot validates period and never creates a hold or draft", async () => {
    const result = await read();
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json().data).toMatchObject({
      facilityId: f.facilityId,
      unitTypeId: f.typeId,
      period: { startsAt: start.toISOString(), endsAt: end.toISOString() },
      availableCount: 1,
    });
    expect(Number.isNaN(Date.parse(result.json().data.asOf))).toBe(false);
    expect(
      await db
        .select()
        .from(capacityAllocations)
        .where(eq(capacityAllocations.facilityId, f.facilityId)),
    ).toHaveLength(0);
    expect(
      await db.select().from(bookings).where(eq(bookings.facilityId, f.facilityId)),
    ).toHaveLength(0);
    expect(
      (
        await f.api(
          null,
          "GET",
          `/facilities/${f.facilityId}/availability?unitTypeId=${f.typeId}&checkInDate=2034-02-01&checkInSlotId=${slotId}&durationMonths=0`,
        )
      ).statusCode,
    ).toBe(400);
    const invalid = await f.api(
      null,
      "GET",
      `/facilities/${f.facilityId}/availability?unitTypeId=${f.typeId}&checkInDate=2020-01-01&checkInSlotId=${slotId}&durationMonths=1`,
    );
    expect(invalid.statusCode).toBe(400);
  });
  test("active overlaps reduce capacity; expired holds and adjacent intervals do not", async () => {
    const allocationId = randomUUID();
    await db.insert(capacityAllocations).values({
      id: allocationId,
      facilityId: f.facilityId,
      unitTypeId: f.typeId,
      referenceId: randomUUID(),
      kind: "HOLD",
      startsAt: start,
      endsAt: end,
      expiresAt: new Date(Date.now() + 60000),
    });
    try {
      expect((await read()).json().data.availableCount).toBe(0);
      await db
        .update(capacityAllocations)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(capacityAllocations.id, allocationId));
      expect((await read()).json().data.availableCount).toBe(1);
      await db
        .update(capacityAllocations)
        .set({ expiresAt: null, startsAt: end, endsAt: new Date(end.getTime() + 86400000) })
        .where(eq(capacityAllocations.id, allocationId));
      expect((await read()).json().data.availableCount).toBe(1);
    } finally {
      await db.delete(capacityAllocations).where(eq(capacityAllocations.id, allocationId));
    }
  });
  test("assigned booking is counted once and occupied/maintenance units are not forecast", async () => {
    await db.insert(storageUnits).values({
      id: extraUnitId,
      facilityId: f.facilityId,
      unitTypeId: f.typeId,
      code: randomUUID(),
    });
    await db.insert(bookings).values({
      id: bookingId,
      userId: f.ids.customer,
      facilityId: f.facilityId,
      unitTypeId: f.typeId,
      checkInSlotId: slotId,
      checkInDate: "2034-02-01",
      requestedMonths: 1,
      rentalEndAt: end,
      monthlyRateSnapshot: "1000000",
      rentalFeeAmount: "1000000",
      depositAmount: "1000000",
      totalAmount: "2000000",
      status: "CONFIRMED",
      contactPhone: "0901234567",
    });
    await db
      .insert(unitAssignments)
      .values({ bookingId, physicalUnitId: f.unitId, assignedBy: f.ids.manager });
    await db.insert(capacityAllocations).values({
      facilityId: f.facilityId,
      unitTypeId: f.typeId,
      referenceId: bookingId,
      kind: "BOOKING",
      startsAt: start,
      endsAt: end,
    });
    expect((await read()).json().data.availableCount).toBe(1);
    await db.update(storageUnits).set({ status: "OCCUPIED" }).where(eq(storageUnits.id, f.unitId));
    expect((await read()).json().data.availableCount).toBe(1);
    await db
      .update(storageUnits)
      .set({ status: "MAINTENANCE" })
      .where(eq(storageUnits.id, f.unitId));
    expect((await read()).json().data.availableCount).toBe(1);
  });
});
