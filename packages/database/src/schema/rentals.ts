import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { enumToPgEnum } from "../enum-to-pg-enum";
import { bookings } from "./bookings";
import { reservations } from "./reservations";
import { storageUnits } from "./storage-units";
import { users } from "./users";

export enum RentalStatus {
  ACTIVE = "ACTIVE",
  CLOSED = "CLOSED",
}

export const rentalStatusEnum = pgEnum("rental_status", enumToPgEnum(RentalStatus));

export const rentals = pgTable(
  "rentals",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingId: uuid()
      .unique()
      .references(() => bookings.id, { onDelete: "restrict" }),
    reservationId: uuid()
      .unique()
      .references(() => reservations.id, { onDelete: "restrict" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    storageUnitId: uuid()
      .notNull()
      .references(() => storageUnits.id, { onDelete: "restrict" }),
    status: rentalStatusEnum().default(RentalStatus.ACTIVE).notNull(),
    startAt: timestamp({ withTimezone: true }).notNull(),
    endAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check("rentals_reference_valid", sql`num_nonnulls(${t.bookingId}, ${t.reservationId}) = 1`),
    check("rentals_period_valid", sql`${t.endAt} > ${t.startAt}`),
    index("rentals_user_idx").on(t.userId),
    index("rentals_unit_status_idx").on(t.storageUnitId, t.status, t.endAt),
  ],
);

export type Rental = typeof rentals.$inferSelect;
export type NewRental = typeof rentals.$inferInsert;
