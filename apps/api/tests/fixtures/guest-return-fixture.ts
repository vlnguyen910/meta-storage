import { randomUUID } from "node:crypto";
import {
  bookings,
  checkInSlots,
  db,
  eq,
  facilityOperatingHours,
  facilityReturnCalendars,
  inArray,
  notificationOutbox,
  rentals,
  returnAudit,
  returnRequests,
  storageUnits,
} from "@metastorage/database";
import { createInspectionFixture } from "./inspection-fixture";

export async function createGuestReturnFixture() {
  const fixture = await createInspectionFixture();
  const rentalId = randomUUID();
  const slotId = randomUUID();
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  await db.transaction(async (tx) => {
    await tx
      .update(bookings)
      .set({ status: "CHECKED_IN" })
      .where(eq(bookings.id, fixture.bookingId));
    await tx
      .update(storageUnits)
      .set({ status: "OCCUPIED" })
      .where(eq(storageUnits.id, fixture.unitId));
    await tx.insert(rentals).values({
      id: rentalId,
      bookingId: fixture.bookingId,
      facilityId: fixture.facilityId,
      physicalUnitId: fixture.unitId,
      status: "ACTIVE",
      startAt: new Date(Date.now() - 86400000),
      expectedEndAt: new Date(Date.now() + 30 * 86400000),
      depositAmount: "500000",
    });
    await tx.insert(checkInSlots).values({
      id: slotId,
      name: `Return ${rentalId}`,
      startTime: "09:00:00",
      endTime: "10:30:00",
    });
    await tx.insert(facilityReturnCalendars).values({
      facilityId: fixture.facilityId,
      timezone: "Asia/Ho_Chi_Minh",
      holidays: [],
      version: 1,
      updatedBy: fixture.managerId,
    });
    await tx.insert(facilityOperatingHours).values(
      Array.from({ length: 7 }, (_, dayOfWeek) => ({
        facilityId: fixture.facilityId,
        dayOfWeek,
        openTime: "08:00:00",
        closeTime: "18:00:00",
        timezone: "Asia/Ho_Chi_Minh",
      })),
    );
  });
  async function reset() {
    const ids = db
      .select({ id: returnRequests.id })
      .from(returnRequests)
      .where(eq(returnRequests.rentalId, rentalId));
    await db.delete(returnAudit).where(inArray(returnAudit.requestId, ids));
    await db.delete(returnRequests).where(eq(returnRequests.rentalId, rentalId));
    await db.delete(notificationOutbox).where(eq(notificationOutbox.bookingId, fixture.bookingId));
    await db
      .update(rentals)
      .set({ status: "ACTIVE", closedAt: null })
      .where(eq(rentals.id, rentalId));
    await db
      .update(facilityReturnCalendars)
      .set({ holidays: [] })
      .where(eq(facilityReturnCalendars.facilityId, fixture.facilityId));
  }
  return {
    ...fixture,
    rentalId,
    slotId,
    date,
    reset,
    async cleanup() {
      await reset();
      await db
        .delete(facilityReturnCalendars)
        .where(eq(facilityReturnCalendars.facilityId, fixture.facilityId));
      await db
        .delete(facilityOperatingHours)
        .where(eq(facilityOperatingHours.facilityId, fixture.facilityId));
      await db.delete(checkInSlots).where(eq(checkInSlots.id, slotId));
      await fixture.cleanup();
    },
  };
}
