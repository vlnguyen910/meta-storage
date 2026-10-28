import { foreignKey, index, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { enumToPgEnum } from "../enum-to-pg-enum";
import { facilities } from "./facilities";
import { unitTypes } from "./unit-types";

export enum CapacityAllocationKind {
  HOLD = "HOLD",
  BOOKING = "BOOKING",
}
export enum CapacityAllocationStatus {
  ACTIVE = "ACTIVE",
  RELEASED = "RELEASED",
  EXPIRED = "EXPIRED",
}
export const capacityAllocationKindEnum = pgEnum(
  "capacity_allocation_kind",
  enumToPgEnum(CapacityAllocationKind),
);
export const capacityAllocationStatusEnum = pgEnum(
  "capacity_allocation_status",
  enumToPgEnum(CapacityAllocationStatus),
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
    status: capacityAllocationStatusEnum().default(CapacityAllocationStatus.ACTIVE).notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.facilityId, table.unitTypeId],
      foreignColumns: [unitTypes.facilityId, unitTypes.id],
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
