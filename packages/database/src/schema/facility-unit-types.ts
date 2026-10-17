import { boolean, index, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { facilities } from "./facilities";
import { unitTypes } from "./unit-types";

export const facilityUnitTypes = pgTable(
  "facility_unit_types",
  {
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    unitTypeId: uuid()
      .notNull()
      .references(() => unitTypes.id, { onDelete: "restrict" }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.facilityId, table.unitTypeId] }),
    index("facility_unit_types_unit_type_idx").on(table.unitTypeId),
  ],
);

export type FacilityUnitType = typeof facilityUnitTypes.$inferSelect;
export type NewFacilityUnitType = typeof facilityUnitTypes.$inferInsert;
