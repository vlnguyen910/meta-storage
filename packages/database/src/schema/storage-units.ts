import { foreignKey, index, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { enumToPgEnum } from "../enum-to-pg-enum";
import { StorageUnitStatus } from "./enums";
import { facilities } from "./facilities";
import { unitTypes } from "./unit-types";

export const storageUnitStatusEnum = pgEnum("storage_unit_status", enumToPgEnum(StorageUnitStatus));

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
    status: storageUnitStatusEnum().default(StorageUnitStatus.AVAILABLE).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.facilityId, table.unitTypeId],
      foreignColumns: [unitTypes.facilityId, unitTypes.id],
    }).onDelete("restrict"),
    index("storage_units_facility_idx").on(table.facilityId),
    index("storage_units_facility_status_idx").on(table.facilityId, table.status),
    index("storage_units_unit_type_idx").on(table.unitTypeId),
  ],
);

export type StorageUnit = typeof storageUnits.$inferSelect;
export type NewStorageUnit = typeof storageUnits.$inferInsert;
