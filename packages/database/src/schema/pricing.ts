import { PricingChangeOperation, type PricingChangeValues } from "@metastorage/contracts/pricing";
import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const pricingChangeOperationEnum = pgEnum(
  "pricing_change_operation",
  PricingChangeOperation,
);
export const pricingChanges = pgTable(
  "pricing_changes",
  {
    id: uuid().defaultRandom().primaryKey(),
    version: integer().notNull().unique(),
    operation: pricingChangeOperationEnum().notNull(),
    before: jsonb().$type<PricingChangeValues>().notNull(),
    after: jsonb().$type<PricingChangeValues>().notNull(),
    changedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    changedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [check("pricing_changes_positive_version", sql`${table.version} > 0`)],
);
