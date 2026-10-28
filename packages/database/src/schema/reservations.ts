import {
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { enumToPgEnum } from "../enum-to-pg-enum";
import { ReservationStatus } from "./enums";
import { facilities } from "./facilities";
import { unitTypes } from "./unit-types";
import { users } from "./users";

export { ReservationStatus } from "./enums";

export const reservationStatusEnum = pgEnum("reservation_status", enumToPgEnum(ReservationStatus));

export const reservations = pgTable(
  "reservations",
  {
    id: uuid().defaultRandom().primaryKey(),
    reservationCode: varchar({ length: 50 }).unique(),
    customerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id),
    unitTypeId: uuid().notNull(),
    requestedMonths: integer().notNull(),
    rentalStartAt: timestamp({ withTimezone: true }),
    rentalEndAt: timestamp({ withTimezone: true }).notNull(),
    monthlyRateSnapshot: numeric({ precision: 14, scale: 2 }).notNull(),
    rentalFeeAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    depositAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    totalAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    status: reservationStatusEnum().default(ReservationStatus.DRAFT).notNull(),
    qrTokenHash: varchar({ length: 255 }).unique(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.facilityId, table.unitTypeId],
      foreignColumns: [unitTypes.facilityId, unitTypes.id],
    }).onDelete("restrict"),
    index("reservations_facility_status_idx").on(table.facilityId, table.status),
    index("reservations_customer_idx").on(table.customerId),
  ],
);

export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;

export { ReservationStatus as BookingStatus };
export type Booking = Reservation;
export type NewBooking = NewReservation;
