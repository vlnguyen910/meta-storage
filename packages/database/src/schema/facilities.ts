import { boolean, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const facilities = pgTable("facilities", {
  id: uuid().defaultRandom().primaryKey(),
  code: varchar({ length: 50 }).notNull().unique(),
  name: varchar({ length: 150 }).notNull(),
  address: text().notNull(),
  description: text(),
  isActive: boolean().default(true).notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export type Facility = typeof facilities.$inferSelect;
export type NewFacility = typeof facilities.$inferInsert;
