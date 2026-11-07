import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const rentalPriceRanges = pgTable(
  "rental_price_ranges",
  {
    id: uuid().defaultRandom().primaryKey(),
    code: varchar({ length: 80 }).notNull(),
    name: varchar({ length: 100 }).notNull(),
    minMonthlyPrice: integer(),
    maxMonthlyPrice: integer(),
    isActive: boolean().default(true).notNull(),
    version: integer().default(0).notNull(),
    updatedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("rental_price_ranges_code_unique").on(table.code),
    check(
      "rental_price_ranges_bounds_valid",
      sql`(${table.minMonthlyPrice} IS NULL AND ${table.maxMonthlyPrice} IS NULL) OR (${table.minMonthlyPrice} IS NOT NULL AND ${table.maxMonthlyPrice} IS NOT NULL AND ${table.minMonthlyPrice} > 0 AND ${table.maxMonthlyPrice} >= ${table.minMonthlyPrice})`,
    ),
    check("rental_price_ranges_version_valid", sql`${table.version} >= 0`),
  ],
);

export type RentalPriceRange = typeof rentalPriceRanges.$inferSelect;
export type NewRentalPriceRange = typeof rentalPriceRanges.$inferInsert;
