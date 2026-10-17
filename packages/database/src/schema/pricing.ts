import { PricingChangeOperation, type PricingChangeValues } from "@metastorage/contracts/pricing";
import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const PRICING_SETTINGS_ID = "default";
export const pricingSettings = pgTable(
  "pricing_settings",
  {
    id: text().primaryKey(),
    depositMonths: integer("deposit_months").notNull(),
    version: integer().notNull(),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("pricing_settings_singleton", sql`${table.id} = 'default'`),
    check("pricing_settings_positive", sql`${table.depositMonths} > 0 AND ${table.version} > 0`),
  ],
);

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
    changedBy: uuid("changed_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [check("pricing_changes_positive_version", sql`${table.version} > 0`)],
);
