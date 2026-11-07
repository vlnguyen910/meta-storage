import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const unitTypes = pgTable(
  "unit_types",
  {
    id: uuid().defaultRandom().primaryKey(),
    version: integer().default(0).notNull(),
    updatedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    code: varchar({ length: 80 }).notNull(),
    name: varchar({ length: 100 }).notNull(),
    coverUrl: text(),
    sizeLabel: varchar({ length: 50 }).notNull(),
    lengthM: numeric({ mode: "number" }).notNull(),
    widthM: numeric({ mode: "number" }).notNull(),
    heightM: numeric({ mode: "number" }).notNull(),
    sizeCbm: numeric({ mode: "number" })
      .generatedAlwaysAs(sql`"length_m" * "width_m" * "height_m"`)
      .notNull(),
    minMonthlyPrice: integer().notNull(),
    maxMonthlyPrice: integer().notNull(),
    isActive: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unit_types_code_idx").on(table.code),
    check(
      "unit_types_price_bounds",
      sql`${table.minMonthlyPrice} > 0 AND ${table.maxMonthlyPrice} >= ${table.minMonthlyPrice}`,
    ),
    check("unit_types_version_valid", sql`${table.version} >= 0`),
    check(
      "unit_types_positive_dimensions",
      sql`${table.lengthM} > 0 AND ${table.widthM} > 0 AND ${table.heightM} > 0`,
    ),
  ],
);

export type UnitType = typeof unitTypes.$inferSelect;
export type NewUnitType = typeof unitTypes.$inferInsert;
