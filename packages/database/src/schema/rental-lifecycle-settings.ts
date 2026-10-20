import type { RentalLifecycleSettingKeyValue } from "@metastorage/contracts";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const rentalLifecycleSettings = pgTable("rental_lifecycle_settings", {
  key: text().$type<RentalLifecycleSettingKeyValue>().primaryKey(),
  value: integer().notNull(),
  description: text().notNull(),
  version: integer().default(0).notNull(),
  updatedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
