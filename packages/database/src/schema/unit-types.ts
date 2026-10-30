import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  numeric,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { facilities } from "./facilities";
import { users } from "./users";

export const unitTypes = pgTable(
  "unit_types",
  {
    id: uuid().defaultRandom().primaryKey(),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    version: integer().default(0).notNull(),
    updatedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    code: varchar({ length: 80 }).notNull(),
    name: varchar({ length: 100 }).notNull(),
    sizeLabel: varchar({ length: 50 }).notNull(),
    lengthM: numeric({ mode: "number" }).notNull(),
    widthM: numeric({ mode: "number" }).notNull(),
    heightM: numeric({ mode: "number" }).notNull(),
    sizeCbm: numeric({ mode: "number" })
      .generatedAlwaysAs(sql`"length_m" * "width_m" * "height_m"`)
      .notNull(),
    monthlyPrice: integer().notNull(),
    isActive: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unit_types_facility_code_idx").on(table.facilityId, table.code),
    unique("unit_types_facility_id_idx").on(table.facilityId, table.id),
    check("unit_types_price_positive", sql`${table.monthlyPrice} > 0`),
    check("unit_types_version_valid", sql`${table.version} >= 0`),
    check(
      "unit_types_positive_dimensions",
      sql`${table.lengthM} > 0 AND ${table.widthM} > 0 AND ${table.heightM} > 0`,
    ),
  ],
);

export type UnitType = typeof unitTypes.$inferSelect;
export type NewUnitType = typeof unitTypes.$inferInsert;
