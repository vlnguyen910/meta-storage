import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { pgTable, uuid } from "drizzle-orm/pg-core";
import type { Database } from "./client";
import { bookings, capacityAllocations, rentals, storageUnits, unitAssignments } from "./schema";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
const legacyReservationDrafts = pgTable("reservation_drafts", {
  id: uuid().primaryKey(),
});

export async function removeGuestBookings(tx: Transaction) {
  const [legacy] = await tx.execute<{ drafts: string | null }>(
    sql`select to_regclass('public.reservation_drafts')::text as drafts`,
  );
  const guests = tx.select({ id: bookings.id }).from(bookings).where(isNull(bookings.userId));
  const guestRentals = tx
    .select({ id: rentals.id })
    .from(rentals)
    .where(inArray(rentals.bookingId, guests));
  const units = await tx
    .select({ id: unitAssignments.physicalUnitId })
    .from(unitAssignments)
    .where(inArray(unitAssignments.bookingId, guests));
  const occupied = await tx
    .select({ id: rentals.physicalUnitId })
    .from(rentals)
    .where(inArray(rentals.bookingId, guests));
  await tx.delete(capacityAllocations).where(inArray(capacityAllocations.referenceId, guests));
  await tx
    .delete(capacityAllocations)
    .where(inArray(capacityAllocations.referenceId, guestRentals));

  // PostgreSQL catalog/DDL has no query-builder equivalent. Temporary CASCADE handles
  // dependent business rows and FK cycles atomically; original constraints are restored.
  const constraints = await tx.execute<{
    schema: string;
    table: string;
    name: string;
    definition: string;
  }>(sql`
    with recursive descendants(oid) as (
      select oid from pg_class
      where oid in ('public.bookings'::regclass, to_regclass('public.reservation_drafts'))
      union
      select c.conrelid from pg_constraint c join descendants d on d.oid = c.confrelid where c.contype = 'f'
    )
    select n.nspname as schema, t.relname as table, c.conname as name,
           pg_get_constraintdef(c.oid) as definition
    from pg_constraint c join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f' and c.confrelid in (select oid from descendants)
  `);
  for (const constraint of constraints) {
    const table = sql`${sql.identifier(constraint.schema)}.${sql.identifier(constraint.table)}`;
    const name = sql.identifier(constraint.name);
    const definition = / ON DELETE /.test(constraint.definition)
      ? constraint.definition.replace(
          / ON DELETE (NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)/,
          " ON DELETE CASCADE",
        )
      : `${constraint.definition} ON DELETE CASCADE`;
    await tx.execute(sql`alter table ${table} drop constraint ${name}`);
    await tx.execute(sql`alter table ${table} add constraint ${name} ${sql.raw(definition)}`);
  }
  await tx.delete(bookings).where(isNull(bookings.userId));
  if (legacy?.drafts) {
    // Legacy reservation drafts have no account owner and are no longer a checkout path.
    const drafts = tx.select({ id: legacyReservationDrafts.id }).from(legacyReservationDrafts);
    await tx.delete(capacityAllocations).where(inArray(capacityAllocations.referenceId, drafts));
    await tx.delete(legacyReservationDrafts);
  }
  for (const constraint of constraints) {
    const table = sql`${sql.identifier(constraint.schema)}.${sql.identifier(constraint.table)}`;
    const name = sql.identifier(constraint.name);
    await tx.execute(sql`alter table ${table} drop constraint ${name}`);
    await tx.execute(
      sql`alter table ${table} add constraint ${name} ${sql.raw(constraint.definition)}`,
    );
  }
  const unitIds = [...new Set([...units, ...occupied].map((unit) => unit.id))];
  if (unitIds.length) {
    const retainedRentals = tx
      .select({ id: rentals.physicalUnitId })
      .from(rentals)
      .where(inArray(rentals.status, ["ACTIVE", "RETURN_PENDING", "OVERDUE", "ABANDONED_REVIEW"]));
    const retainedAssignments = tx
      .select({ id: unitAssignments.physicalUnitId })
      .from(unitAssignments)
      .where(eq(unitAssignments.status, "ACTIVE"));
    await tx
      .update(storageUnits)
      .set({ status: "AVAILABLE", updatedAt: new Date() })
      .where(
        and(
          inArray(storageUnits.id, unitIds),
          inArray(storageUnits.status, ["RESERVED", "OCCUPIED", "RETURN_PENDING", "INSPECTION"]),
          notInArray(storageUnits.id, retainedRentals),
          notInArray(storageUnits.id, retainedAssignments),
        ),
      );
  }
}
