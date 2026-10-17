import { index, numeric, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { facilities } from "./facilities";
import { storageUnits } from "./storage-units";

export const rentals = pgTable(
  "rentals",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingId: uuid()
      .notNull()
      .unique()
      .references(() => bookings.id),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id),
    physicalUnitId: uuid()
      .notNull()
      .references(() => storageUnits.id),
    status: varchar({ length: 50 }).default("ACTIVE").notNull(),
    startAt: timestamp({ withTimezone: true }).notNull(),
    expectedEndAt: timestamp({ withTimezone: true }).notNull(),
    actualReturnAt: timestamp({ withTimezone: true }),
    closedAt: timestamp({ withTimezone: true }),
    depositAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("rentals_facility_idx").on(table.facilityId),
    index("rentals_active_unit_idx").on(table.physicalUnitId, table.status, table.expectedEndAt),
  ],
);

export type Rental = typeof rentals.$inferSelect;
export type NewRental = typeof rentals.$inferInsert;
