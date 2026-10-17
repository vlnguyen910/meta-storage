import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const unitTypes = pgTable(
  "unit_types",
  {
    id: uuid().defaultRandom().primaryKey(),
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
    uniqueIndex("unit_types_code_idx").on(table.code),
    check(
      "unit_types_positive_dimensions",
      sql`${table.lengthM} > 0 AND ${table.widthM} > 0 AND ${table.heightM} > 0`,
    ),
  ],
);

export type UnitType = typeof unitTypes.$inferSelect;
export type NewUnitType = typeof unitTypes.$inferInsert;
