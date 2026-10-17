import { foreignKey, index, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { facilities } from "./facilities";
import { facilityUnitTypes } from "./facility-unit-types";

export const STORAGE_UNIT_STATUSES = [
  "AVAILABLE",
  "RESERVED",
  "OCCUPIED",
  "MAINTENANCE",
  "INSPECTION",
  "RETURN_PENDING",
  "LOCKED",
  "INACTIVE",
] as const;

export const storageUnitStatusEnum = pgEnum("storage_unit_status", STORAGE_UNIT_STATUSES);

export const storageUnits = pgTable(
  "storage_units",
  {
    id: uuid().defaultRandom().primaryKey(),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    unitTypeId: uuid().notNull(),
    code: varchar({ length: 80 }).notNull().unique(),
    floor: varchar({ length: 50 }),
    locationDescription: varchar({ length: 255 }),
    status: storageUnitStatusEnum().default("AVAILABLE").notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.facilityId, table.unitTypeId],
      foreignColumns: [facilityUnitTypes.facilityId, facilityUnitTypes.unitTypeId],
    }).onDelete("restrict"),
    index("storage_units_facility_idx").on(table.facilityId),
    index("storage_units_facility_status_idx").on(table.facilityId, table.status),
    index("storage_units_unit_type_idx").on(table.unitTypeId),
  ],
);

export type StorageUnit = typeof storageUnits.$inferSelect;
export type NewStorageUnit = typeof storageUnits.$inferInsert;
