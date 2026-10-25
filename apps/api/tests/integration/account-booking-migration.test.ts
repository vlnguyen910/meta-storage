import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  bookings,
  capacityAllocations,
  checkInSlots,
  db,
  eq,
  facilities,
  payments,
  rentals,
  sql,
  storageUnits,
  unitAssignments,
  users,
} from "@metastorage/database";
import { removeGuestBookings } from "../../../../packages/database/src/migrate-account-bookings";
import { createTestUnitType } from "../fixtures/facility-catalog";
import { assertTestDatabase } from "../fixtures/test-database";

const target = process.env.BOOKING_TEST_DATABASE_URL;

describe.skipIf(!target)("account booking data migration", () => {
  test("deletes guest dependants, restores constraints and preserves account business records", async () => {
    assertTestDatabase(target, process.env);
    const rollback = new Error("rollback migration fixture");
    try {
      await db.transaction(async (tx) => {
        const owner = randomUUID(),
          facility = randomUUID(),
          type = randomUUID(),
          slot = randomUUID();
        const guest = randomUUID(),
          retained = randomUUID(),
          unit = randomUUID(),
          rental = randomUUID();
        const payment = randomUUID();
        // Reproduce the old nullable owner inside this rolled-back, isolated transaction.
        await tx.execute(sql`alter table bookings alter column user_id drop not null`);
        await tx.insert(users).values({
          id: owner,
          name: "Migration customer",
          email: `${owner}@example.test`,
          role: "CUSTOMER",
          status: "ACTIVE",
        });
        await tx
          .insert(facilities)
          .values({ id: facility, code: facility, name: "Migration", address: "Test" });
        await createTestUnitType(tx, {
          facilityId: facility,
          id: type,
          code: type,
          name: "Migration",
          sizeLabel: "S",
          lengthM: 1,
          widthM: 1,
          heightM: 1,
          monthlyPrice: 1000000,
        });
        await tx
          .insert(checkInSlots)
          .values({ id: slot, name: "Migration", startTime: "09:00", endTime: "10:00" });
        await tx.insert(storageUnits).values({
          id: unit,
          code: unit,
          facilityId: facility,
          unitTypeId: type,
          status: "OCCUPIED",
        });
        const values = {
          facilityId: facility,
          unitTypeId: type,
          checkInDate: "2031-01-01",
          checkInSlotId: slot,
          requestedMonths: 1,
          rentalEndAt: new Date("2031-02-01T02:00:00Z"),
          monthlyRateSnapshot: "1000000",
          rentalFeeAmount: "1000000",
          depositAmount: "1000000",
          totalAmount: "2000000",
          contactPhone: "0901234567",
          status: "CONFIRMED",
        };
        await tx.insert(bookings).values([
          { ...values, id: guest, userId: null as never },
          { ...values, id: retained, userId: owner },
        ]);
        await tx.insert(rentals).values({
          id: rental,
          bookingId: guest,
          facilityId: facility,
          physicalUnitId: unit,
          startAt: new Date("2031-01-01T02:00:00Z"),
          expectedEndAt: values.rentalEndAt,
          depositAmount: "1000000",
        });
        await tx
          .insert(unitAssignments)
          .values({ bookingId: guest, physicalUnitId: unit, assignedBy: owner });
        await tx.insert(payments).values({
          id: payment,
          holdTokenHash: "migration-fixture-hold",
          bookingId: guest,
          provider: "mock",
          providerPaymentId: payment,
          paymentCode: payment.replaceAll("-", ""),
          idempotencyKey: payment,
          totalAmount: "2000000",
          currency: "VND",
          status: "SUCCEEDED",
        });
        await tx.insert(capacityAllocations).values({
          referenceId: guest,
          facilityId: facility,
          unitTypeId: type,
          kind: "BOOKING",
          status: "ACTIVE",
          startsAt: new Date("2031-01-01T02:00:00Z"),
          endsAt: values.rentalEndAt,
        });
        const definitions = await tx.execute<{ name: string; definition: string }>(sql`
          select conname as name, pg_get_constraintdef(oid) as definition from pg_constraint
          where connamespace = 'public'::regnamespace order by conname
        `);
        await removeGuestBookings(tx);
        expect(await tx.select().from(bookings).where(eq(bookings.id, guest))).toHaveLength(0);
        expect(await tx.select().from(rentals).where(eq(rentals.id, rental))).toHaveLength(0);
        expect(await tx.select().from(payments).where(eq(payments.id, payment))).toHaveLength(0);
        expect(
          await tx.select().from(unitAssignments).where(eq(unitAssignments.bookingId, guest)),
        ).toHaveLength(0);
        expect(
          await tx
            .select()
            .from(capacityAllocations)
            .where(eq(capacityAllocations.referenceId, guest)),
        ).toHaveLength(0);
        expect(
          (await tx.select().from(storageUnits).where(eq(storageUnits.id, unit)))[0]?.status,
        ).toBe("AVAILABLE");
        expect((await tx.select().from(bookings).where(eq(bookings.id, retained)))[0]?.userId).toBe(
          owner,
        );
        const after = await tx.execute<{ name: string; definition: string }>(sql`
          select conname as name, pg_get_constraintdef(oid) as definition from pg_constraint
          where connamespace = 'public'::regnamespace order by conname
        `);
        expect([...after]).toEqual([...definitions]);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
