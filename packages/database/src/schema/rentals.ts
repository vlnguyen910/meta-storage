import { ReturnRequestStatus } from "@metastorage/contracts/returns";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { checkInSlots } from "./check-in-slots";
import { facilities } from "./facilities";
import { storageUnits } from "./storage-units";
import { users } from "./users";

export const rentalReturnStatusEnum = pgEnum("rental_return_status", ReturnRequestStatus);

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
    version: integer().default(0).notNull(),
    actualReturnAt: timestamp({ withTimezone: true }),
    closedAt: timestamp({ withTimezone: true }),
    abandonedReviewAt: timestamp({ withTimezone: true }),
    returnSlotId: uuid().references(() => checkInSlots.id, { onDelete: "restrict" }),
    returnDate: date(),
    returnStartsAt: timestamp({ withTimezone: true }),
    returnEndsAt: timestamp({ withTimezone: true }),
    returnTimezone: text(),
    returnStatus: rentalReturnStatusEnum(),
    returnReason: text(),
    returnManualReviewRequired: boolean().default(false).notNull(),
    returnSettlement: jsonb().$type<{
      depositSnapshot: string;
      rateSnapshot: number;
      overdueFeeAmount: string;
      damageAmount: string;
      unusedRentRefundAmount: string;
      refundEntitlement: string;
      debtAmount: string;
      actualReturnAt: string;
      refundDueDate: string;
      calendarSnapshot: { timezone: string };
      rentalChargeId: string | null;
    }>(),
    returnSettlementApprovedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    returnSettlementApprovedAt: timestamp({ withTimezone: true }),
    returnSettlementReason: text(),
    depositAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("rentals_version_nonnegative", sql`${table.version} >= 0`),
    check(
      "rentals_return_schedule_valid",
      sql`(
        ${table.returnDate} IS NULL AND ${table.returnSlotId} IS NULL AND ${table.returnStartsAt} IS NULL AND ${table.returnEndsAt} IS NULL AND ${table.returnTimezone} IS NULL AND ${table.returnStatus} IS NULL AND ${table.returnReason} IS NULL
      ) OR (
        ${table.returnDate} IS NOT NULL AND ${table.returnSlotId} IS NOT NULL AND ${table.returnStartsAt} IS NOT NULL AND ${table.returnEndsAt} IS NOT NULL AND ${table.returnTimezone} IS NOT NULL AND ${table.returnStatus} IS NOT NULL AND ${table.returnReason} IS NOT NULL AND ${table.returnEndsAt} > ${table.returnStartsAt}
      )`,
    ),
    check(
      "rentals_return_settlement_valid",
      sql`(${table.returnSettlement} IS NULL AND ${table.returnSettlementApprovedBy} IS NULL AND ${table.returnSettlementApprovedAt} IS NULL AND ${table.returnSettlementReason} IS NULL) OR (${table.returnSettlement} IS NOT NULL AND ${table.returnSettlementApprovedBy} IS NOT NULL AND ${table.returnSettlementApprovedAt} IS NOT NULL AND ${table.returnSettlementReason} IS NOT NULL)`,
    ),
    index("rentals_facility_idx").on(table.facilityId),
    index("rentals_active_unit_idx").on(table.physicalUnitId, table.status, table.expectedEndAt),
    index("rentals_return_schedule_idx").on(table.facilityId, table.returnDate, table.returnSlotId),
    uniqueIndex("rentals_return_slot_capacity_idx")
      .on(table.facilityId, table.returnDate, table.returnSlotId)
      .where(sql`${table.returnStatus} IN ('CONFIRMED', 'INSPECTING', 'FAILED')`),
  ],
);

export type Rental = typeof rentals.$inferSelect;
export type NewRental = typeof rentals.$inferInsert;
