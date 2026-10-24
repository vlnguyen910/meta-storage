import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { facilities } from "./facilities";
import { rentalPriceRanges } from "./rental-price-ranges";
import { users } from "./users";

export const unitTypes = pgTable(
  "unit_types",
  {
    id: uuid().defaultRandom().primaryKey(),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    priceRangeId: uuid()
      .notNull()
      .references(() => rentalPriceRanges.id, { onDelete: "restrict" }),
    version: integer().default(0).notNull(),
    updatedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    code: varchar({ length: 80 }).notNull(),
    name: varchar({ length: 100 }).notNull(),
    sizeLabel: varchar("size_label", { length: 50 }).notNull(),
    lengthM: numeric("length_m", { mode: "number" }).notNull(),
    widthM: numeric("width_m", { mode: "number" }).notNull(),
    heightM: numeric("height_m", { mode: "number" }).notNull(),
    sizeCbm: numeric("size_cbm", { mode: "number" })
      .generatedAlwaysAs(sql`"length_m" * "width_m" * "height_m"`)
      .notNull(),
    monthlyPrice: integer("monthly_price").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unit_types_facility_code_idx").on(table.facilityId, table.code),
    uniqueIndex("unit_types_facility_id_idx").on(table.facilityId, table.id),
    index("unit_types_price_range_idx").on(table.priceRangeId),
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
