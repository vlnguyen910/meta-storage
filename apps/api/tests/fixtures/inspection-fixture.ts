import { randomUUID } from "node:crypto";
import { HANDOVER_CHECKLIST_ITEMS } from "@metastorage/contracts";
import {
  accounts,
  and,
  bookings,
  checkInSlots,
  db,
  eq,
  facilities,
  facilityAssignments,
  facilityTasks,
  inArray,
  inspections,
  mediaAssets,
  notificationOutbox,
  or,
  payments,
  rentals,
  storageUnits,
  unitAssignments,
  unitTypes,
  users,
} from "@metastorage/database";
import { hashPassword } from "better-auth/crypto";
import { createTestUnitType, deleteTestUnitTypes } from "./facility-catalog";
import { assertTestDatabase } from "./test-database";

export const passingChecklist = HANDOVER_CHECKLIST_ITEMS.map((item) => ({
  itemCode: item.code,
  resultType: "PASS_FAIL" as const,
  result: "PASS" as const,
  note: null,
  photos: [],
}));

export function assertIsolatedDatabase(allowExistingLocal = false) {
  assertTestDatabase(
    process.env.DATABASE_URL,
    process.env,
    allowExistingLocal && process.env.DATABASE_URL === process.env.MY_STORAGE_LOCAL_DATABASE_URL,
  );
}

export async function createInspectionFixture(allowExistingLocal = false) {
  assertIsolatedDatabase(allowExistingLocal);
  const suffix = randomUUID().slice(0, 8);
  const userId = randomUUID(),
    outsiderId = randomUUID(),
    managerId = randomUUID(),
    customerId = randomUUID(),
    facilityId = randomUUID(),
    unitTypeId = randomUUID(),
    unitId = randomUUID(),
    bookingId = randomUUID(),
    assignmentId = randomUUID(),
    slotId = randomUUID();
  const email = `inspection-${suffix}@example.test`,
    outsiderEmail = `outside-${suffix}@example.test`,
    managerEmail = `manager-${suffix}@example.test`,
    password = "InspectionTest123!";
  const now = Date.now();
  const rentalEnd = new Date(now + 30 * 86400_000);
  await db.transaction(async (tx) => {
    await tx.insert(users).values([
      {
        id: customerId,
        name: "Test customer",
        email: `customer-${suffix}@example.test`,
        role: "CUSTOMER",
        status: "ACTIVE",
        emailVerified: true,
      },
      {
        id: managerId,
        name: "Facility Manager",
        email: managerEmail,
        role: "FACILITY_MANAGER",
        status: "ACTIVE",
        emailVerified: true,
      },
      {
        id: userId,
        name: "Assigned Staff",
        email,
        role: "FACILITY_STAFF",
        status: "ACTIVE",
        emailVerified: true,
      },
      {
        id: outsiderId,
        name: "Other facility staff",
        email: outsiderEmail,
        role: "FACILITY_STAFF",
        status: "ACTIVE",
        emailVerified: true,
      },
    ]);
    const hashed = await hashPassword(password);
    await tx.insert(accounts).values([
      {
        id: randomUUID(),
        userId: customerId,
        accountId: customerId,
        providerId: "credential",
        password: hashed,
      },
      {
        id: randomUUID(),
        userId: managerId,
        accountId: managerId,
        providerId: "credential",
        password: hashed,
      },
      { id: randomUUID(), userId, accountId: userId, providerId: "credential", password: hashed },
      {
        id: randomUUID(),
        userId: outsiderId,
        accountId: outsiderId,
        providerId: "credential",
        password: hashed,
      },
    ]);
    await tx.insert(facilities).values({
      id: facilityId,
      code: `TEST-${suffix}`,
      name: "Inspection test facility",
      address: "Isolated test database",
    });
    await tx.insert(facilityAssignments).values([
      { userId, facilityId, role: "FACILITY_STAFF" },
      { userId: managerId, facilityId, role: "FACILITY_MANAGER" },
      { userId: outsiderId, facilityId, role: "FACILITY_STAFF" },
    ]);
    await createTestUnitType(tx, {
      facilityId: facilityId,
      id: unitTypeId,
      code: `TEST2-${suffix}`,
      name: "Kho rỗng",
      sizeLabel: "2 m²",
      lengthM: 1,
      widthM: 2,
      heightM: 2,
      monthlyPrice: 1000000,
    });

    const local = new Date(now + 7 * 3600000).toISOString();
    await tx.insert(checkInSlots).values({
      id: slotId,
      name: `Test slot ${suffix}`,
      startTime: "00:00:00",
      endTime: "23:59:59",
    });
    await tx.insert(storageUnits).values({
      id: unitId,
      facilityId,
      unitTypeId,
      code: `TEST-UNIT-${suffix}`,
      status: "RESERVED",
    });
    await tx.insert(bookings).values({
      id: bookingId,
      bookingCode: `BK-TEST-${suffix.toUpperCase()}`,
      userId: customerId,
      contactName: "Test customer",
      contactEmail: `customer-${suffix}@example.test`,
      contactPhone: "0900000000",
      facilityId,
      unitTypeId,
      requestedMonths: 1,
      checkInDate: local.slice(0, 10),
      checkInSlotId: slotId,
      status: "CONFIRMED",
      rentalEndAt: rentalEnd,
      monthlyRateSnapshot: "1000000",
      rentalFeeAmount: "1000000",
      depositAmount: "500000",
      totalAmount: "1500000",
      assignedStaffId: userId,
    });
    await tx.insert(payments).values({
      bookingId,
      holdTokenHash: suffix,
      provider: "mock",
      paymentCode: `TEST-${suffix}`,
      providerPaymentId: suffix,
      idempotencyKey: suffix,
      totalAmount: "1500000",
      currency: "VND",
      status: "SUCCEEDED",
      paidAt: new Date(now - 86400_000),
    });
    await tx
      .insert(unitAssignments)
      .values({ id: assignmentId, bookingId, physicalUnitId: unitId, assignedBy: userId });
  });
  return {
    customerId,
    customerEmail: `customer-${suffix}@example.test`,
    userId,
    managerId,
    managerEmail,
    outsiderId,
    facilityId,
    bookingId,
    bookingCode: `BK-TEST-${suffix.toUpperCase()}`,
    assignmentId,
    unitId,
    email,
    outsiderEmail,
    password,
    async cleanup() {
      await db.transaction(async (tx) => {
        const taskRows = await tx
          .select({ id: facilityTasks.id })
          .from(facilityTasks)
          .where(eq(facilityTasks.facilityId, facilityId));
        const taskIds = taskRows.map((t) => t.id);

        const inspectionRows = await tx
          .select({ id: inspections.id })
          .from(inspections)
          .where(
            taskIds.length > 0
              ? or(eq(inspections.bookingId, bookingId), inArray(inspections.taskId, taskIds))
              : eq(inspections.bookingId, bookingId),
          );
        const inspectionIds = inspectionRows.map((row) => row.id);
        if (inspectionIds.length > 0) {
          await tx
            .delete(mediaAssets)
            .where(
              and(
                eq(mediaAssets.ownerType, "INSPECTION"),
                inArray(mediaAssets.ownerId, inspectionIds),
              ),
            );
          await tx.delete(inspections).where(inArray(inspections.id, inspectionIds));
        }
        await tx.delete(notificationOutbox).where(eq(notificationOutbox.bookingId, bookingId));
        await tx.delete(rentals).where(eq(rentals.bookingId, bookingId));
        await tx.delete(unitAssignments).where(eq(unitAssignments.bookingId, bookingId));
        await tx.delete(payments).where(eq(payments.bookingId, bookingId));
        await tx.delete(bookings).where(eq(bookings.id, bookingId));
        await tx.delete(storageUnits).where(eq(storageUnits.id, unitId));

        await tx.delete(facilityTasks).where(eq(facilityTasks.facilityId, facilityId));
        await tx.delete(facilityAssignments).where(eq(facilityAssignments.facilityId, facilityId));
        await deleteTestUnitTypes(tx, eq(unitTypes.id, unitTypeId));
        await tx.delete(facilities).where(eq(facilities.id, facilityId));
        await tx.delete(checkInSlots).where(eq(checkInSlots.id, slotId));
        await tx
          .delete(users)
          .where(inArray(users.id, [userId, managerId, outsiderId, customerId]));
      });
    },
  };
}

if (import.meta.main) {
  console.log(JSON.stringify(await createInspectionFixture()));
  const { queryClient } = await import("@metastorage/database");
  await queryClient.end();
}
