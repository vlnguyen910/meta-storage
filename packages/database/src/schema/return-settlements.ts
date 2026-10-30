import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { inspections } from "./inspections";
import { payments } from "./payments";
import { rentals } from "./rentals";
import { users } from "./users";

export const returnSettlements = pgTable(
  "return_settlements",
  {
    id: uuid().defaultRandom().primaryKey(),
    rentalId: uuid()
      .notNull()
      .unique()
      .references(() => rentals.id, { onDelete: "restrict" }),
    inspectionId: uuid()
      .notNull()
      .unique()
      .references(() => inspections.id, { onDelete: "restrict" }),
    sourcePaymentId: uuid()
      .notNull()
      .references((): AnyPgColumn => payments.id, { onDelete: "restrict" }),
    depositAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    deductionAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    currency: varchar({ length: 3 }).notNull(),
    settledBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    settledAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "return_settlements_amounts_valid",
      sql`${table.depositAmount} >= 0 AND ${table.deductionAmount} >= 0`,
    ),
  ],
);
