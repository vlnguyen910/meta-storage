import { afterAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import {
  bookings,
  checkInSlots,
  facilities,
  payments,
  rentals,
  storageUnits,
  users,
} from "../src/schema";

const target = process.env.RENTAL_MIGRATION_TEST_DATABASE_URL;
let connection: typeof import("../src/client").queryClient | undefined;
afterAll(async () => {
  if (connection) await connection.end();
});

test.skipIf(!target)(
  "upgrades populated rental schema, preserves owners/dates/payments and rolls back incompatible legacy data",
  async () => {
    if (
      !target ||
      !new URL(target).pathname.startsWith("/metastorage_inspection_test_rental_reset_")
    )
      throw new Error("Isolated rental test database required");
    const { db, queryClient } = await import("../src/client");
    connection = queryClient;
    const { applyMigrations } = await import("../src/migrate");
    const migrations = readMigrationFiles({
      migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
    });
    expect(await applyMigrations(db, migrations.slice(0, -1))).toBe(8);
    const userId = randomUUID(),
      facilityId = randomUUID(),
      typeId = randomUUID(),
      unitId = randomUUID(),
      slotId = randomUUID();
    await db.insert(users).values({
      id: userId,
      name: "Migration fixture",
      email: `${userId}@example.test`,
      role: "CUSTOMER",
      status: "ACTIVE",
    });
    await db
      .insert(facilities)
      .values({ id: facilityId, code: facilityId, name: "Migration", address: "Test" });
    const priceRangeId = randomUUID();
    await db.execute(
      sql`INSERT INTO rental_price_ranges (id, code, name) VALUES (${priceRangeId}, ${priceRangeId}, 'Test')`,
    );
    await db.execute(sql`INSERT INTO unit_types (id, facility_id, price_range_id, code, name, size_label, length_m, width_m, height_m, monthly_price)
    VALUES (${typeId}, ${facilityId}, ${priceRangeId}, ${typeId}, 'Test', 'S', 1, 1, 1, 1000000)`);
    await db
      .insert(storageUnits)
      .values({ id: unitId, facilityId, unitTypeId: typeId, code: unitId });
    await db
      .insert(checkInSlots)
      .values({ id: slotId, name: "Test", startTime: "09:00", endTime: "10:00" });
    const expected = [];
    for (const status of ["ACTIVE", "RETURN_PENDING", "OVERDUE", "CLOSED"]) {
      const bookingId = randomUUID(),
        rentalId = randomUUID();
      await db.insert(bookings).values({
        id: bookingId,
        userId,
        facilityId,
        unitTypeId: typeId,
        requestedMonths: 1,
        checkInDate: "2032-01-01",
        checkInSlotId: slotId,
        rentalEndAt: new Date("2032-02-01T02:00:00Z"),
        monthlyRateSnapshot: "1000000",
        rentalFeeAmount: "1000000",
        depositAmount: "1000000",
        totalAmount: "2000000",
        contactPhone: "0900000000",
        status: "CHECKED_IN",
      });
      await db.execute(sql`INSERT INTO rentals (id, booking_id, facility_id, physical_unit_id, status, start_at, expected_end_at, deposit_amount)
      VALUES (${rentalId}, ${bookingId}, ${facilityId}, ${unitId}, ${status}::rental_status, '2032-01-01T02:00:00Z', '2032-02-01T02:00:00Z', 1000000)`);
      expected.push({ rentalId, bookingId, status: status === "CLOSED" ? "CLOSED" : "ACTIVE" });
    }
    const first = expected[0];
    if (!first) throw new Error("Missing fixture");
    const paymentId = randomUUID();
    await db.insert(payments).values({
      id: paymentId,
      bookingId: first.bookingId,
      holdTokenHash: "migration-test",
      provider: "mock",
      providerPaymentId: paymentId,
      paymentCode: paymentId.replaceAll("-", ""),
      idempotencyKey: paymentId,
      currency: "VND",
      status: "SUCCEEDED",
      totalAmount: "2000000",
      paidAt: new Date(),
    });
    // A retired audit operation must not be silently erased or mislabeled.
    await db.execute(sql`INSERT INTO pricing_changes (version, operation, "before", "after", changed_by)
    VALUES (1, 'RENTAL_PRICE_RANGE', '{}', '{}', ${userId})`);
    await expect(applyMigrations(db, migrations)).rejects.toThrow();
    const before = await db.execute(
      sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'user_id'`,
    );
    expect(before).toHaveLength(0);
    const history = await db.execute(
      sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`,
    );
    expect(history[0]?.count).toBe(8);
    await db.execute(sql`DELETE FROM pricing_changes WHERE changed_by = ${userId}`);
    // A return refund belongs to the retired financial workflow; migration must stop.
    const refundId = randomUUID();
    await db.execute(sql`INSERT INTO payments (id, type, rental_id, source_payment_id, idempotency_key, total_amount, currency, status, refund_reference, refunded_at, refunded_by)
    VALUES (${refundId}, 'RETURN_REFUND', ${first.rentalId}, ${paymentId}, ${refundId}, 100000, 'VND', 'SUCCEEDED', ${refundId}, now(), ${userId})`);
    await expect(applyMigrations(db, migrations)).rejects.toThrow();
    const preserved = await db.execute(sql`SELECT id FROM payments WHERE id = ${refundId}`);
    expect(preserved).toHaveLength(1);
    await db.execute(sql`DELETE FROM payments WHERE id = ${refundId}`);
    expect(await applyMigrations(db, migrations)).toBe(1);
    expect(await applyMigrations(db, migrations)).toBe(0);
    const migrated = await db.select().from(rentals);
    expect(migrated).toHaveLength(4);
    for (const item of expected) {
      const row = migrated.find((rental) => rental.id === item.rentalId);
      expect(row?.bookingId).toBe(item.bookingId);
      expect(row?.userId).toBe(userId);
      expect(row?.storageUnitId).toBe(unitId);
      expect(row?.status).toBe(item.status);
      expect(row?.startAt.toISOString()).toBe("2032-01-01T02:00:00.000Z");
      expect(row?.endAt.toISOString()).toBe("2032-02-01T02:00:00.000Z");
    }
    const columns = await db.execute(
      sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals'`,
    );
    expect(columns.map((row) => row.column_name).sort()).toEqual(
      [
        "id",
        "booking_id",
        "user_id",
        "storage_unit_id",
        "status",
        "start_at",
        "end_at",
        "created_at",
        "updated_at",
      ].sort(),
    );
    const retired = await db.execute(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('rental_charges', 'rental_charge_events', 'rental_charge_adjustments', 'rental_charge_refunds', 'rental_renewals', 'rental_price_ranges')`,
    );
    expect(retired).toHaveLength(0);
    const payment = await db.execute(
      sql`SELECT booking_id, total_amount, status FROM payments WHERE id = ${paymentId}`,
    );
    expect(payment[0]?.booking_id).toBe(first.bookingId);
    expect(payment[0]?.total_amount).toBe("2000000.00");
    expect(payment[0]?.status).toBe("SUCCEEDED");
  },
);
