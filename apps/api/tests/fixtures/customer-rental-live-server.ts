// Test-only server: real routes, sessions and PostgreSQL; only external storage/provider lookup are substituted.
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { SYSTEM_SETTING_DEFINITIONS } from "@metastorage/contracts";
import {
  bookings,
  capacityAllocations,
  checkInSlots,
  db,
  eq,
  payments,
  RentalStatus,
  rentals,
  storageUnits,
  systemSettings,
  unitAssignments,
  unitTypes,
  users,
} from "@metastorage/database";
import { migrateBookingsToReservations } from "../../../../packages/database/src/migrate-bookings-to-reservations";
import { corsPlugin } from "../../src/common/plugins/cors";
import { appointmentsRoutes } from "../../src/modules/appointments/appointments.routes";
import { authRoutes } from "../../src/modules/auth/auth.routes";
import { facilitiesRoutes } from "../../src/modules/facilities/facilities.routes";
import { paymentsRoutes } from "../../src/modules/payments/payments.routes";
import { SepayPaymentGateway } from "../../src/modules/payments/sepay.gateway";
import { rentalsRoutes } from "../../src/modules/rentals/rentals.routes";
import { reservationsRoutes } from "../../src/modules/reservations/reservations.routes";
import { supportRoutes } from "../../src/modules/support/support.routes";
import { createFacilityOperationsFixture } from "./facility-operations";
import { assertTestDatabase } from "./test-database";

assertTestDatabase(process.env.MY_STORAGE_LOCAL_DATABASE_URL, process.env);
if (!process.env.CUSTOMER_E2E_FIXTURE) throw new Error("CUSTOMER_E2E_FIXTURE is required");
// Paid events arrive via the real authenticated webhook in the browser test. Never call external SePay with test credentials.
SepayPaymentGateway.prototype.retrievePayment = async () => null;
const f = await createFacilityOperationsFixture();
await db
  .update(unitTypes)
  .set({ name: "Customer available type" })
  .where(eq(unitTypes.id, f.typeId));
await f.app.register(corsPlugin);
await f.app.register(authRoutes, { prefix: "/api/auth" });
await f.app.register(reservationsRoutes, { prefix: "/api/reservations" });
await f.app.register(appointmentsRoutes, { prefix: "/api/appointments" });
await f.app.register(facilitiesRoutes, { prefix: "/api/facilities" });
await f.app.register(paymentsRoutes, { prefix: "/api" });
await f.app.register(rentalsRoutes, { prefix: "/api/rentals" });
await f.app.register(supportRoutes, { prefix: "/api/support" });
await db
  .insert(systemSettings)
  .values(
    Object.entries(SYSTEM_SETTING_DEFINITIONS).map(([key, value]) => ({
      key: key as keyof typeof SYSTEM_SETTING_DEFINITIONS,
      value: value.defaultValue,
      description: value.description,
      version: 1,
    })),
  )
  .onConflictDoNothing();
const slotId = randomUUID();
await db
  .insert(checkInSlots)
  .values({ id: slotId, name: "Customer live slot", startTime: "09:00", endTime: "10:00" });
const rentalIds: string[] = [];
const bookingIds: string[] = [];
const rentalRows: (typeof rentals.$inferInsert)[] = [];
for (let i = 0; i < 3; i++) {
  const id = randomUUID();
  const unitId = randomUUID();
  const rentalId = randomUUID();
  const start = new Date(Date.now() - (i === 2 ? 200 : 7) * 86400000);
  const end = new Date(start.getTime() + 90 * 86400000);
  await db.insert(storageUnits).values({
    id: unitId,
    facilityId: f.facilityId,
    unitTypeId: f.typeId,
    code: `LIVE-${i + 1}`,
    status: i === 2 ? "AVAILABLE" : "OCCUPIED",
  });
  await db.insert(bookings).values({
    id,
    userId: f.ids.customer,
    facilityId: f.facilityId,
    unitTypeId: f.typeId,
    checkInSlotId: slotId,
    bookingCode: `LIVE-CUSTOMER-${i + 1}`,
    contactPhone: "0901234567",
    checkInDate: start.toISOString().slice(0, 10),
    requestedMonths: 3,
    rentalEndAt: end,
    monthlyRateSnapshot: "1000000",
    rentalFeeAmount: "3000000",
    depositAmount: "1000000",
    totalAmount: "4000000",
    status: "CONFIRMED",
  });
  await db.insert(payments).values({
    bookingId: id,
    holdTokenHash: randomUUID(),
    provider: "sepay",
    providerPaymentId: randomUUID(),
    paymentCode: randomUUID().replaceAll("-", ""),
    idempotencyKey: randomUUID(),
    totalAmount: "4000000",
    currency: "VND",
    status: "SUCCEEDED",
    paidAt: start,
  });
  rentalIds.push(rentalId);
  bookingIds.push(id);
  if (i < 2) {
    await db.insert(capacityAllocations).values({
      facilityId: f.facilityId,
      unitTypeId: f.typeId,
      referenceId: id,
      kind: "BOOKING",
      startsAt: start,
      endsAt: end,
    });
    await db
      .insert(unitAssignments)
      .values({ bookingId: id, physicalUnitId: unitId, assignedBy: f.ids.manager });
  }
  rentalRows.push({
    id: rentalId,
    bookingId: id,
    userId: i === 3 ? f.ids.peerStaff : f.ids.customer,
    storageUnitId: unitId,
    startAt: start,
    endAt: end,
    status: i === 2 ? RentalStatus.CLOSED : RentalStatus.ACTIVE,
  });
}
await db.update(users).set({ role: "CUSTOMER" }).where(eq(users.id, f.ids.peerStaff));
const failedBookingId = randomUUID(),
  failedPaymentId = randomUUID();
await db.insert(bookings).values({
  id: failedBookingId,
  userId: f.ids.customer,
  facilityId: f.facilityId,
  unitTypeId: f.typeId,
  checkInSlotId: slotId,
  checkInDate: "2034-02-01",
  requestedMonths: 1,
  rentalEndAt: new Date("2034-03-03T02:00:00Z"),
  monthlyRateSnapshot: "1000000",
  rentalFeeAmount: "1000000",
  depositAmount: "1000000",
  totalAmount: "2000000",
  status: "DRAFT",
});
await db.insert(payments).values({
  id: failedPaymentId,
  bookingId: failedBookingId,
  holdTokenHash: randomUUID(),
  provider: "sepay",
  providerPaymentId: randomUUID(),
  paymentCode: randomUUID().replaceAll("-", ""),
  idempotencyKey: randomUUID(),
  totalAmount: "2000000",
  currency: "VND",
  status: "FAILED",
});
await f.login();
await db.insert(rentals).values(rentalRows);
for (const id of bookingIds)
  await db.update(bookings).set({ status: "CHECKED_IN" }).where(eq(bookings.id, id));
await db.transaction(migrateBookingsToReservations);
const address = await f.app.listen({
  host: "127.0.0.1",
  port: Number(process.env.CUSTOMER_E2E_API_PORT ?? 4100),
});
await writeFile(
  process.env.CUSTOMER_E2E_FIXTURE,
  JSON.stringify({
    api: `${address}/api`,
    facilityId: f.facilityId,
    typeId: f.typeId,
    slotId,
    rentalIds,
    bookingIds,
    failedBookingId,
    failedPaymentId,
    email: `${f.ids.customer}@example.test`,
    password: "FacilityOperationsTest123!",
    otherEmail: `${f.ids.peerStaff}@example.test`,
    managerEmail: `${f.ids.manager}@example.test`,
    staffEmail: `${f.ids.staff}@example.test`,
  }),
);
console.log("Customer rental live API ready on isolated PostgreSQL");
