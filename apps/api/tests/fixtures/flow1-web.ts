import {
  accounts,
  checkInSlots,
  db,
  facilities,
  facilityAssignments,
  queryClient,
  storageUnits,
  users,
} from "@metastorage/database";
import { hashPassword } from "better-auth/crypto";
import { createTestUnitType } from "./facility-catalog";

// Dedicated, repeatable browser fixtures. Never run against a development or production database.
const target = process.env.BOOKING_TEST_DATABASE_URL;
if (!target || target !== process.env.DATABASE_URL || !new URL(target).pathname.endsWith("test"))
  throw new Error("Flow 1 fixtures require an isolated BOOKING_TEST_DATABASE_URL");

const facilityId = "12000000-0000-4000-8000-000000000001";
const unitTypeId = "12000000-0000-4000-8000-000000000002";
const slotId = "12000000-0000-4000-8000-000000000003";
const managerId = "12000000-0000-4000-8000-000000000004";
const scarceTypeId = "12000000-0000-4000-8000-000000000005";
try {
  const password = await hashPassword("Flow1-browser-test-123!");
  await db.transaction(async (tx) => {
    await tx
      .insert(facilities)
      .values({
        id: facilityId,
        code: "FLOW1-120",
        name: "Flow 1 Browser Facility",
        address: "Flow 1 Test City",
      })
      .onConflictDoNothing();
    await createTestUnitType(tx, {
      facilityId: facilityId,
      id: unitTypeId,
      code: "FLOW1-120",
      name: "Flow 1 Browser Unit",
      sizeLabel: "S",
      lengthM: 2,
      widthM: 2,
      heightM: 2,
      monthlyPrice: 1000000,
    });

    await createTestUnitType(tx, {
      facilityId: facilityId,
      id: scarceTypeId,
      code: "FLOW1-120-LAST",
      name: "Flow 1 Last Unit",
      sizeLabel: "S",
      lengthM: 1,
      widthM: 1,
      heightM: 2,
      monthlyPrice: 1000000,
    });

    await tx
      .insert(storageUnits)
      .values({ code: "FLOW1-120-LAST", facilityId, unitTypeId: scarceTypeId })
      .onConflictDoNothing();
    await tx
      .insert(storageUnits)
      .values(
        Array.from({ length: 40 }, (_, index) => ({
          code: `FLOW1-120-${index}`,
          facilityId,
          unitTypeId,
        })),
      )
      .onConflictDoNothing();
    await tx
      .insert(checkInSlots)
      .values({ id: slotId, name: "Flow 1 Browser Slot", startTime: "09:00", endTime: "11:00" })
      .onConflictDoNothing();
    await tx
      .insert(users)
      .values({
        id: managerId,
        name: "Flow 1 Manager",
        email: "flow1-manager@example.test",
        emailVerified: true,
        role: "FACILITY_MANAGER",
        status: "ACTIVE",
      })
      .onConflictDoNothing();
    await tx
      .insert(accounts)
      .values({
        id: "flow1-120-credential",
        userId: managerId,
        accountId: managerId,
        providerId: "credential",
        password,
      })
      .onConflictDoUpdate({ target: accounts.id, set: { password } });
    await tx
      .insert(facilityAssignments)
      .values({ userId: managerId, facilityId, role: "FACILITY_MANAGER" })
      .onConflictDoNothing();
  });
  console.log("Flow 1 browser fixtures ready on the isolated database.");
} finally {
  await queryClient.end();
}
