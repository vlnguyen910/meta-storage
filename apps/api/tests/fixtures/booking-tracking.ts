import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import {
  bookings,
  checkInSlots,
  db,
  eq,
  facilities,
  facilityUnitTypes,
  payments,
  unitTypes,
} from "../../../../packages/database/src";
import {
  bookingDeliveryKey,
  bookingMagicKey,
} from "../../../../packages/shared/src/booking-access";
import { createBookingTrackingLink } from "../../src/modules/bookings/booking-tracking-link";

export async function createTrackingFixture() {
  const id = randomUUID();
  const ids = {
    facility: randomUUID(),
    type: randomUUID(),
    slot: randomUUID(),
    booking: randomUUID(),
  };
  const redis = new Redis(process.env.REDIS_TEST_URL ?? "redis://127.0.0.1:6379/14");
  await db.transaction(async (tx) => {
    await tx.insert(facilities).values({
      id: ids.facility,
      code: id,
      name: "Kho StoreX kiểm thử",
      address: "123 Đường kiểm thử, TP.HCM",
    });
    await tx.insert(unitTypes).values({
      id: ids.type,
      code: id,
      name: "Kho nhỏ",
      sizeLabel: "2 m²",
      lengthM: 1,
      widthM: 2,
      heightM: 2,
      monthlyPrice: 900000,
    });
    await tx.insert(facilityUnitTypes).values({ facilityId: ids.facility, unitTypeId: ids.type });
    await tx
      .insert(checkInSlots)
      .values({ id: ids.slot, name: "Ca kiểm thử", startTime: "09:00", endTime: "10:30" });
    await tx.insert(bookings).values({
      id: ids.booking,
      bookingCode: `E2E-${id}`,
      status: "CONFIRMED",
      contactName: "Khách kiểm thử",
      contactEmail: "guest@example.test",
      contactPhone: "0900000000",
      facilityId: ids.facility,
      unitTypeId: ids.type,
      checkInDate: "2031-02-01",
      checkInSlotId: ids.slot,
      rentalEndAt: new Date("2031-04-01T02:00:00Z"),
      requestedMonths: 2,
      monthlyRateSnapshot: "900000",
      rentalFeeAmount: "1800000",
      depositAmount: "900000",
      totalAmount: "2700000",
    });
    await tx.insert(payments).values({
      bookingId: ids.booking,
      holdTokenHash: id,
      provider: "test",
      providerPaymentId: id,
      paymentCode: id.slice(0, 32),
      idempotencyKey: id,
      totalAmount: "2700000",
      currency: "VND",
      status: "SUCCEEDED",
      paidAt: new Date("2031-01-01T00:00:00Z"),
    });
  });
  const link = await createBookingTrackingLink(redis, {
    deliveryId: id,
    bookingId: ids.booking,
    publicAppUrl: "http://127.0.0.1:3000",
    secret: "test-only-magic-link-secret-32-characters",
    confirmedAt: new Date(),
  });
  const token = new URL(link.trackingUrl).hash.slice("#token=".length);
  return {
    ...link,
    code: `E2E-${id}`,
    expire: () => redis.del(bookingMagicKey(token)),
    cleanup: async () => {
      await redis.del(bookingMagicKey(token), bookingDeliveryKey(id));
      await redis.quit();
      await db.delete(payments).where(eq(payments.bookingId, ids.booking));
      await db.delete(bookings).where(eq(bookings.id, ids.booking));
      await db.delete(checkInSlots).where(eq(checkInSlots.id, ids.slot));
      await db.delete(facilityUnitTypes).where(eq(facilityUnitTypes.facilityId, ids.facility));
      await db.delete(unitTypes).where(eq(unitTypes.id, ids.type));
      await db.delete(facilities).where(eq(facilities.id, ids.facility));
    },
  };
}
