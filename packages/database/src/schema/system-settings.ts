import type {
  SystemSettingKeyValue,
  SystemSettingSnapshot,
  SystemSettingValue,
} from "@metastorage/contracts/system-settings";
import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const systemSettings = pgTable(
  "system_settings",
  {
    key: text().$type<SystemSettingKeyValue>().primaryKey(),
    value: jsonb().$type<SystemSettingValue>().notNull(),
    description: text().notNull(),
    version: integer().default(0).notNull(),
    updatedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check("system_settings_version_valid", sql`${t.version} >= 0`),
    check(
      "system_settings_value_scalar",
      sql`jsonb_typeof(${t.value}) in ('number', 'string', 'boolean')`,
    ),
    // Preserve database-level bounds of the former financial policy tables.
    check(
      "system_settings_known_integer",
      sql`${t.key} not in ('EXPIRY_REMINDER_DAYS', 'ABANDONED_REVIEW_DAYS', 'OVERDUE_FEE_RATE', 'DEPOSIT_MONTHS', 'OPENING_HOUR', 'CLOSING_HOUR') or (jsonb_typeof(${t.value}) = 'number' and (${t.value} #>> '{}')::numeric between 0 and 2147483647 and trunc((${t.value} #>> '{}')::numeric) = (${t.value} #>> '{}')::numeric)`,
    ),
    check(
      "system_settings_overdue_rate",
      sql`${t.key} <> 'OVERDUE_FEE_RATE' or (${t.value} #>> '{}')::numeric between 0 and 100`,
    ),
    check(
      "system_settings_deposit_policy",
      sql`${t.key} <> 'DEPOSIT_MONTHS' or ((${t.value} #>> '{}')::numeric > 0 and ${t.version} > 0)`,
    ),
    check(
      "system_settings_operating_hour",
      sql`${t.key} not in ('OPENING_HOUR', 'CLOSING_HOUR') or (${t.value} #>> '{}')::integer between 0 and 24`,
    ),
  ],
);

export const systemSettingChanges = pgTable(
  "system_setting_changes",
  {
    id: uuid().defaultRandom().primaryKey(),
    key: text()
      .$type<SystemSettingKeyValue>()
      .notNull()
      .references(() => systemSettings.key, { onDelete: "restrict" }),
    before: jsonb().$type<SystemSettingSnapshot>().notNull(),
    after: jsonb().$type<SystemSettingSnapshot>().notNull(),
    actorId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    source: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("system_setting_changes_key_idx").on(t.key, t.createdAt)],
);

// Numeric extraction is needed inside pricing SQL joins and lifecycle snapshots.
export const systemSettingInteger = sql<number>`(${systemSettings.value} #>> '{}')::integer`;
