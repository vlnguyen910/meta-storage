import { sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

export const rentalPriceRanges = pgTable(
  "rental_price_ranges",
  {
    id: uuid().defaultRandom().primaryKey(),
    code: varchar({ length: 80 }).notNull().unique(),
    name: varchar({ length: 100 }).notNull(),
    minMonthlyPrice: integer(),
    maxMonthlyPrice: integer(),
    isActive: boolean().default(true).notNull(),
    version: integer().default(0).notNull(),
    updatedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "rental_price_ranges_bounds_valid",
      sql`(${t.minMonthlyPrice} is null and ${t.maxMonthlyPrice} is null) or (${t.minMonthlyPrice} is not null and ${t.maxMonthlyPrice} is not null and ${t.minMonthlyPrice} > 0 and ${t.maxMonthlyPrice} >= ${t.minMonthlyPrice})`,
    ),
    check("rental_price_ranges_version_valid", sql`${t.version} >= 0`),
  ],
);
