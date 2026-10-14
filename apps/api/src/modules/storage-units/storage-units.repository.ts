import {
  and,
  bookings,
  capacityAllocations,
  checkInSlots,
  count,
  type Database,
  eq,
  gt,
  isNull,
  lt,
  max,
  ne,
  notExists,
  notInArray,
  or,
  sql,
  storageUnits,
  sum,
  unitAssignments,
} from "@metastorage/database";

export class StorageUnitsRepository {
  constructor(private readonly db: Pick<Database, "select" | "$with" | "with">) {}

  async getAvailableCapacity(facilityId: string, unitTypeId: string, startsAt: Date, endsAt: Date) {
    const checkInStart = sql`(${bookings.checkInDate} + ${checkInSlots.startTime})
      at time zone 'Asia/Ho_Chi_Minh'`;
    const conflictingAssignments = this.db
      .select({ id: unitAssignments.id })
      .from(unitAssignments)
      .innerJoin(bookings, eq(bookings.id, unitAssignments.bookingId))
      .innerJoin(checkInSlots, eq(checkInSlots.id, bookings.checkInSlotId))
      .where(
        and(
          eq(unitAssignments.physicalUnitId, storageUnits.id),
          eq(unitAssignments.status, "ACTIVE"),
          notInArray(bookings.status, ["CANCELLED", "NO_SHOW"]),
          lt(checkInStart, endsAt.toISOString()),
          gt(bookings.rentalEndAt, startsAt),
        ),
      );
    const inventory = this.db.$with("capacity_inventory").as(
      this.db
        .select({ total: count().as("total") })
        .from(storageUnits)
        .where(
          and(
            eq(storageUnits.facilityId, facilityId),
            eq(storageUnits.unitTypeId, unitTypeId),
            eq(storageUnits.status, "AVAILABLE"),
            notExists(conflictingAssignments),
          ),
        ),
    );
    // Assigned bookings are accounted for by the physical-unit filter above.
    const assignedBooking = this.db
      .select({ id: unitAssignments.id })
      .from(unitAssignments)
      .innerJoin(storageUnits, eq(storageUnits.id, unitAssignments.physicalUnitId))
      .where(
        and(
          eq(unitAssignments.bookingId, capacityAllocations.referenceId),
          eq(unitAssignments.status, "ACTIVE"),
          eq(storageUnits.facilityId, capacityAllocations.facilityId),
          eq(storageUnits.unitTypeId, capacityAllocations.unitTypeId),
        ),
      );
    const overlapping = this.db.$with("capacity_overlapping").as(
      this.db
        .select({
          startsAt: sql<Date>`greatest(${capacityAllocations.startsAt},
            ${startsAt.toISOString()}::timestamptz)`.as("starts_at"),
          endsAt: sql<Date>`least(${capacityAllocations.endsAt},
            ${endsAt.toISOString()}::timestamptz)`.as("ends_at"),
        })
        .from(capacityAllocations)
        .where(
          and(
            eq(capacityAllocations.facilityId, facilityId),
            eq(capacityAllocations.unitTypeId, unitTypeId),
            eq(capacityAllocations.status, "ACTIVE"),
            lt(capacityAllocations.startsAt, endsAt),
            gt(capacityAllocations.endsAt, startsAt),
            or(
              isNull(capacityAllocations.expiresAt),
              gt(capacityAllocations.expiresAt, new Date()),
            ),
            or(ne(capacityAllocations.kind, "BOOKING"), notExists(assignedBooking)),
          ),
        ),
    );
    const events = this.db.$with("capacity_events").as(
      this.db
        .select({
          at: sql`${overlapping.startsAt}`.as("at"),
          delta: sql<number>`${1}::integer`.as("delta"),
        })
        .from(overlapping)
        .unionAll(
          this.db
            .select({
              at: sql`${overlapping.endsAt}`.as("at"),
              delta: sql<number>`${-1}::integer`.as("delta"),
            })
            .from(overlapping),
        ),
    );
    // Group arrivals and departures at the same instant before the running sum:
    // [start, end) allocations that meet at a boundary do not overlap.
    const occupancy = this.db.$with("capacity_occupancy").as(
      this.db
        .select({
          used: sql<string>`sum(${sum(events.delta)}) over (order by ${events.at})`.as("used"),
        })
        .from(events)
        .groupBy(events.at),
    );
    const peak = this.db
      .$with("capacity_peak")
      .as(this.db.select({ used: max(occupancy.used).as("used") }).from(occupancy));
    // Execute all CTEs in one statement for a consistent snapshot and one round
    // trip; only the resulting capacity is transferred to the application.
    const [row] = await this.db
      .with(inventory, overlapping, events, occupancy, peak)
      .select({
        available: sql<number>`greatest(0, ${inventory.total} - coalesce(${peak.used}, 0))`.mapWith(
          Number,
        ),
      })
      .from(inventory)
      .crossJoin(peak);
    return row?.available ?? 0;
  }
}
