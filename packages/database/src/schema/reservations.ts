import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { enumToPgEnum } from "../enum-to-pg-enum";
import { facilities } from "./facilities";
import { unitTypes } from "./unit-types";
import { users } from "./users";

export enum ReservationStatus {
  DRAFT = "DRAFT",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
  CHECKED_IN = "CHECKED_IN",
  NO_SHOW = "NO_SHOW",
}

export const reservationRecordStatusEnum = pgEnum(
  "reservation_record_status",
  enumToPgEnum(ReservationStatus),
);

export const reservations = pgTable(
  "reservations",
  {
    id: uuid().defaultRandom().primaryKey(),
    customerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    unitTypeId: uuid().notNull(),
    requestedMonths: integer().notNull(),
    rentalStartAt: timestamp({ withTimezone: true }).notNull(),
    rentalEndAt: timestamp({ withTimezone: true }).notNull(),
    monthlyRateSnapshot: integer().notNull(),
    rentalFeeAmount: integer().notNull(),
    depositAmount: integer().notNull(),
    totalAmount: integer().notNull(),
    status: reservationRecordStatusEnum().default(ReservationStatus.DRAFT).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.facilityId, table.unitTypeId],
      foreignColumns: [unitTypes.facilityId, unitTypes.id],
    }).onDelete("restrict"),
    check("reservations_months_valid", sql`${table.requestedMonths} BETWEEN 1 AND 12`),
    check("reservations_period_valid", sql`${table.rentalEndAt} > ${table.rentalStartAt}`),
    check(
      "reservations_amounts_valid",
      sql`${table.monthlyRateSnapshot} >= 0 AND ${table.rentalFeeAmount} >= 0 AND ${table.depositAmount} >= 0 AND ${table.totalAmount} = ${table.rentalFeeAmount} + ${table.depositAmount}`,
    ),
    index("reservations_customer_idx").on(table.customerId, table.createdAt),
    index("reservations_facility_status_idx").on(table.facilityId, table.status),
  ],
);

export type ReservationRecord = typeof reservations.$inferSelect;
export type NewReservationRecord = typeof reservations.$inferInsert;
