import {
  type CreateStorageUnitInput,
  canTransitionStorageUnitStatus,
  STORAGE_UNIT_MESSAGES,
  type StorageUnitListQuery,
  type StorageUnitMaintenanceHistoryQuery,
  type UpdateStorageUnitInput,
} from "@metastorage/contracts";
import {
  and,
  asc,
  bookings,
  capacityAllocations,
  checkInSlots,
  count,
  type Database,
  desc,
  eq,
  facilities,
  facilityUnitTypes,
  gt,
  isNull,
  lt,
  max,
  ne,
  notExists,
  notInArray,
  or,
  rentals,
  type StorageUnit,
  sql,
  storageUnitMaintenanceHistory,
  storageUnits,
  sum,
  unitAssignments,
  unitTypes,
  users,
} from "@metastorage/database";

type DbExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export type TransitionUnitStatusResult =
  | { success: true; unit: StorageUnit }
  | { error: "UNIT_NOT_FOUND" }
  | { error: "TRANSITION_NOT_ALLOWED"; message: string; currentStatus: string }
  | { error: "UNIT_TYPE_UNAVAILABLE" | "UNIT_CODE_CONFLICT" | "UNIT_HAS_OPERATIONS" };

export class StorageUnitsRepository {
  constructor(private readonly db: DbExecutor) {}

  async listByFacility(query: StorageUnitListQuery) {
    const execute = async (tx: DbExecutor) => {
      const [facility] = await tx
        .select({ id: facilities.id })
        .from(facilities)
        .where(eq(facilities.id, query.facilityId));
      if (!facility) return null;
      const filter = and(
        eq(storageUnits.facilityId, query.facilityId),
        query.status ? eq(storageUnits.status, query.status) : undefined,
        query.unitTypeId ? eq(storageUnits.unitTypeId, query.unitTypeId) : undefined,
      );
      const [total] = await tx.select({ value: count() }).from(storageUnits).where(filter);
      const items = await tx
        .select({
          id: storageUnits.id,
          facilityId: storageUnits.facilityId,
          unitTypeId: storageUnits.unitTypeId,
          code: storageUnits.code,
          floor: storageUnits.floor,
          locationDescription: storageUnits.locationDescription,
          status: storageUnits.status,
          createdAt: storageUnits.createdAt,
          updatedAt: storageUnits.updatedAt,
          unitTypeName: unitTypes.name,
          unitTypeSizeLabel: unitTypes.sizeLabel,
        })
        .from(storageUnits)
        .innerJoin(unitTypes, eq(storageUnits.unitTypeId, unitTypes.id))
        .where(filter)
        .orderBy(asc(storageUnits.code), asc(storageUnits.id))
        .limit(query.limit)
        .offset(query.offset);
      return { items, total: total?.value ?? 0 };
    };
    // A repeatable snapshot keeps the total and the page consistent under concurrent writes.
    if ("transaction" in this.db && typeof this.db.transaction === "function") {
      return this.db.transaction(execute, {
        isolationLevel: "repeatable read",
        accessMode: "read only",
      });
    }
    return execute(this.db);
  }

  async findById(id: string): Promise<StorageUnit | undefined> {
    const [unit] = await this.db.select().from(storageUnits).where(eq(storageUnits.id, id));
    return unit;
  }

  async createUnit(
    facilityId: string,
    input: CreateStorageUnitInput,
  ): Promise<StorageUnit | { error: "UNIT_TYPE_UNAVAILABLE" | "UNIT_CODE_CONFLICT" }> {
    return this.db.transaction(async (tx) => {
      const [facility] = await tx
        .select({ id: facilities.id, isActive: facilities.isActive })
        .from(facilities)
        .where(eq(facilities.id, facilityId))
        .for("update");
      const [offering] = await tx
        .select({ id: facilityUnitTypes.unitTypeId })
        .from(facilityUnitTypes)
        .innerJoin(unitTypes, eq(unitTypes.id, facilityUnitTypes.unitTypeId))
        .where(
          and(
            eq(facilityUnitTypes.facilityId, facilityId),
            eq(facilityUnitTypes.unitTypeId, input.unitTypeId),
            eq(facilityUnitTypes.isActive, true),
            eq(unitTypes.isActive, true),
          ),
        )
        .for("update");
      if (!facility?.isActive || !offering) return { error: "UNIT_TYPE_UNAVAILABLE" };
      const [duplicate] = await tx
        .select({ id: storageUnits.id })
        .from(storageUnits)
        .where(eq(storageUnits.code, input.code));
      if (duplicate) return { error: "UNIT_CODE_CONFLICT" };
      const [created] = await tx
        .insert(storageUnits)
        .values({
          facilityId,
          unitTypeId: input.unitTypeId,
          code: input.code,
          floor: input.floor ?? null,
          locationDescription: input.locationDescription ?? null,
        })
        .returning();
      if (!created) throw new Error(STORAGE_UNIT_MESSAGES.persistenceFailed);
      return created;
    });
  }

  async updateUnit(
    id: string,
    input: UpdateStorageUnitInput,
  ): Promise<
    | StorageUnit
    | {
        error:
          | "UNIT_NOT_FOUND"
          | "UNIT_TYPE_UNAVAILABLE"
          | "UNIT_CODE_CONFLICT"
          | "UNIT_HAS_OPERATIONS";
      }
  > {
    return this.db.transaction(async (tx) => {
      const [unit] = await tx
        .select()
        .from(storageUnits)
        .where(eq(storageUnits.id, id))
        .for("update");
      if (!unit) return { error: "UNIT_NOT_FOUND" };
      if (input.code && input.code !== unit.code) {
        const [duplicate] = await tx
          .select({ id: storageUnits.id })
          .from(storageUnits)
          .where(eq(storageUnits.code, input.code));
        if (duplicate) return { error: "UNIT_CODE_CONFLICT" };
      }
      if (input.unitTypeId && input.unitTypeId !== unit.unitTypeId) {
        const [offering] = await tx
          .select({ id: facilityUnitTypes.unitTypeId })
          .from(facilityUnitTypes)
          .innerJoin(unitTypes, eq(unitTypes.id, facilityUnitTypes.unitTypeId))
          .where(
            and(
              eq(facilityUnitTypes.facilityId, unit.facilityId),
              eq(facilityUnitTypes.unitTypeId, input.unitTypeId),
              eq(facilityUnitTypes.isActive, true),
              eq(unitTypes.isActive, true),
            ),
          )
          .for("update");
        if (!offering) return { error: "UNIT_TYPE_UNAVAILABLE" };
        const [rental] = await tx
          .select({ id: rentals.id })
          .from(rentals)
          .where(and(eq(rentals.physicalUnitId, id), eq(rentals.status, "ACTIVE")))
          .limit(1);
        const [assignment] = await tx
          .select({ id: unitAssignments.id })
          .from(unitAssignments)
          .innerJoin(bookings, eq(bookings.id, unitAssignments.bookingId))
          .where(
            and(
              eq(unitAssignments.physicalUnitId, id),
              eq(unitAssignments.status, "ACTIVE"),
              notInArray(bookings.status, ["CANCELLED", "NO_SHOW"]),
            ),
          )
          .limit(1);
        if (rental || assignment) return { error: "UNIT_HAS_OPERATIONS" };
      }
      const [updated] = await tx
        .update(storageUnits)
        .set({
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.floor !== undefined ? { floor: input.floor } : {}),
          ...(input.locationDescription !== undefined
            ? { locationDescription: input.locationDescription }
            : {}),
          ...(input.unitTypeId !== undefined ? { unitTypeId: input.unitTypeId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(storageUnits.id, id))
        .returning();
      if (!updated) return { error: "UNIT_NOT_FOUND" };
      return updated;
    });
  }

  async listMaintenanceHistory(id: string, query: StorageUnitMaintenanceHistoryQuery) {
    return this.db.transaction(
      async (tx) => {
        const filter = eq(storageUnitMaintenanceHistory.storageUnitId, id);
        const [total] = await tx
          .select({ value: count() })
          .from(storageUnitMaintenanceHistory)
          .where(filter);
        const items = await tx
          .select({
            id: storageUnitMaintenanceHistory.id,
            storageUnitId: storageUnitMaintenanceHistory.storageUnitId,
            action: storageUnitMaintenanceHistory.action,
            previousStatus: storageUnitMaintenanceHistory.previousStatus,
            nextStatus: storageUnitMaintenanceHistory.nextStatus,
            reason: storageUnitMaintenanceHistory.reason,
            changedBy: storageUnitMaintenanceHistory.changedBy,
            changedByName: users.name,
            changedAt: storageUnitMaintenanceHistory.changedAt,
          })
          .from(storageUnitMaintenanceHistory)
          .innerJoin(users, eq(users.id, storageUnitMaintenanceHistory.changedBy))
          .where(filter)
          .orderBy(
            desc(storageUnitMaintenanceHistory.changedAt),
            desc(storageUnitMaintenanceHistory.id),
          )
          .limit(query.limit)
          .offset(query.offset);
        return { items, total: total?.value ?? 0 };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async transitionStatus(
    unitId: string,
    targetStatus: "AVAILABLE" | "MAINTENANCE",
    reason: string | undefined,
    actorId: string,
  ): Promise<TransitionUnitStatusResult> {
    const execute = async (tx: DbExecutor) => {
      const [unit] = await tx
        .select()
        .from(storageUnits)
        .where(eq(storageUnits.id, unitId))
        .for("update");

      if (!unit) {
        return { error: "UNIT_NOT_FOUND" as const };
      }

      // Check active rentals
      const [activeRental] = await tx
        .select({ id: rentals.id })
        .from(rentals)
        .where(and(eq(rentals.physicalUnitId, unit.id), eq(rentals.status, "ACTIVE")))
        .limit(1);

      // Check active unit assignments
      const [activeAssignment] = await tx
        .select({ id: unitAssignments.id })
        .from(unitAssignments)
        .innerJoin(bookings, eq(bookings.id, unitAssignments.bookingId))
        .where(
          and(
            eq(unitAssignments.physicalUnitId, unit.id),
            eq(unitAssignments.status, "ACTIVE"),
            notInArray(bookings.status, ["CANCELLED", "NO_SHOW"]),
          ),
        )
        .limit(1);

      const validation = canTransitionStorageUnitStatus(unit.status, targetStatus, {
        hasActiveRental: Boolean(activeRental),
        hasActiveAssignment: Boolean(activeAssignment),
      });

      if (!validation.allowed) {
        return {
          error: "TRANSITION_NOT_ALLOWED" as const,
          message:
            validation.error ??
            STORAGE_UNIT_MESSAGES.invalidStatusTransition(unit.status, targetStatus),
          currentStatus: unit.status,
        };
      }

      const now = new Date();
      const [updated] = await tx
        .update(storageUnits)
        .set({
          status: targetStatus,
          updatedAt: now,
        })
        .where(eq(storageUnits.id, unit.id))
        .returning();

      if (!updated) {
        throw new Error("Failed to update storage unit status");
      }

      await tx.insert(storageUnitMaintenanceHistory).values({
        storageUnitId: unit.id,
        action: targetStatus === "MAINTENANCE" ? "ENTER_MAINTENANCE" : "EXIT_MAINTENANCE",
        previousStatus: unit.status,
        nextStatus: targetStatus,
        reason: reason ?? null,
        changedBy: actorId,
      });

      return { success: true as const, unit: updated };
    };

    if ("transaction" in this.db && typeof this.db.transaction === "function") {
      return this.db.transaction(execute);
    }
    return execute(this.db);
  }

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
