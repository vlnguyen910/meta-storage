import { foreignKey, index, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { facilities } from "./facilities";
import { facilityUnitTypes } from "./facility-unit-types";

export const CAPACITY_ALLOCATION_KINDS = ["HOLD", "BOOKING"] as const;
export const CAPACITY_ALLOCATION_STATUSES = ["ACTIVE", "RELEASED", "EXPIRED"] as const;

export const capacityAllocationKindEnum = pgEnum(
  "capacity_allocation_kind",
  CAPACITY_ALLOCATION_KINDS,
);
export const capacityAllocationStatusEnum = pgEnum(
  "capacity_allocation_status",
  CAPACITY_ALLOCATION_STATUSES,
);

export const capacityAllocations = pgTable(
  "capacity_allocations",
  {
    id: uuid().defaultRandom().primaryKey(),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    unitTypeId: uuid().notNull(),
    referenceId: uuid().notNull(),
    accessTokenHash: varchar({ length: 128 }),
    kind: capacityAllocationKindEnum().notNull(),
    status: capacityAllocationStatusEnum().default("ACTIVE").notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.facilityId, table.unitTypeId],
      foreignColumns: [facilityUnitTypes.facilityId, facilityUnitTypes.unitTypeId],
    }).onDelete("restrict"),
    index("capacity_allocations_unit_type_period_idx").on(
      table.facilityId,
      table.unitTypeId,
      table.startsAt,
      table.endsAt,
    ),
    index("capacity_allocations_reference_idx").on(table.referenceId),
  ],
);

export type CapacityAllocation = typeof capacityAllocations.$inferSelect;
export type NewCapacityAllocation = typeof capacityAllocations.$inferInsert;
