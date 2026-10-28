import { RENTAL_STATUSES, type RentalStatus } from "@metastorage/contracts";
import { ReturnRequestStatus } from "@metastorage/contracts/returns";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { enumToPgEnum } from "../enum-to-pg-enum";
import { facilities } from "./facilities";
import { reservations } from "./reservations";
import { storageUnits } from "./storage-units";
import { users } from "./users";

type RentalReturnStatus = keyof typeof ReturnRequestStatus;
export const rentalStatusEnum = pgEnum("rental_status", enumToPgEnum(RENTAL_STATUSES));
export const rentalReturnStatusEnum = pgEnum(
  "rental_return_status",
  enumToPgEnum(ReturnRequestStatus),
);
export type { RentalReturnStatus, RentalStatus };
export { ReturnRequestStatus };

export const rentals = pgTable(
  "rentals",
  {
    id: uuid().defaultRandom().primaryKey(),
    reservationId: uuid()
      .notNull()
      .unique()
      .references(() => reservations.id),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id),
    physicalUnitId: uuid()
      .notNull()
      .references(() => storageUnits.id),
    status: rentalStatusEnum().default("ACTIVE").notNull(),
    startAt: timestamp({ withTimezone: true }).notNull(),
    expectedEndAt: timestamp({ withTimezone: true }).notNull(),
    version: integer().default(0).notNull(),
    actualReturnAt: timestamp({ withTimezone: true }),
    closedAt: timestamp({ withTimezone: true }),
    abandonedReviewAt: timestamp({ withTimezone: true }),
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
      "rentals_return_state_valid",
      sql`(${table.returnStatus} IS NULL AND ${table.returnReason} IS NULL) OR (${table.returnStatus} IS NOT NULL AND ${table.returnReason} IS NOT NULL)`,
    ),
    check(
      "rentals_return_settlement_valid",
      sql`(${table.returnSettlement} IS NULL AND ${table.returnSettlementApprovedBy} IS NULL AND ${table.returnSettlementApprovedAt} IS NULL AND ${table.returnSettlementReason} IS NULL) OR (${table.returnSettlement} IS NOT NULL AND ${table.returnSettlementApprovedBy} IS NOT NULL AND ${table.returnSettlementApprovedAt} IS NOT NULL AND ${table.returnSettlementReason} IS NOT NULL)`,
    ),
    index("rentals_facility_idx").on(table.facilityId),
    index("rentals_active_unit_idx").on(table.physicalUnitId, table.status, table.expectedEndAt),
  ],
);

export type Rental = typeof rentals.$inferSelect;
export type NewRental = typeof rentals.$inferInsert;
