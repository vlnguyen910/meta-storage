import { sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { facilities } from "./facilities";
import { unitTypes } from "./unit-types";
import { users } from "./users";

export const facilityUnitTypes = pgTable(
  "facility_unit_types",
  {
    id: uuid().defaultRandom().primaryKey(),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    unitTypeId: uuid()
      .notNull()
      .references(() => unitTypes.id, { onDelete: "restrict" }),
    monthlyPrice: integer().notNull(),
    isActive: boolean().default(true).notNull(),
    version: integer().default(0).notNull(),
    updatedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("facility_unit_types_facility_type_idx").on(table.facilityId, table.unitTypeId),
    unique("facility_unit_types_facility_id_idx").on(table.facilityId, table.id),
    check("facility_unit_types_price_positive", sql`${table.monthlyPrice} > 0`),
    check("facility_unit_types_version_valid", sql`${table.version} >= 0`),
  ],
);
export type FacilityUnitType = typeof facilityUnitTypes.$inferSelect;
