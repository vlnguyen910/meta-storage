import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { facilities } from "./facilities";
import { unitAssignments } from "./unit-assignments";
import { users } from "./users";

export const CHECKIN_VERIFICATION_STATUSES = ["VERIFIED", "CONSUMED", "INVALIDATED"] as const;
export type CheckInVerificationStatus = (typeof CHECKIN_VERIFICATION_STATUSES)[number];

export const checkInVerificationStatusEnum = pgEnum(
  "checkin_verification_status",
  CHECKIN_VERIFICATION_STATUSES,
);

export const checkInVerifications = pgTable(
  "checkin_verifications",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    staffId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    unitAssignmentId: uuid()
      .notNull()
      .references(() => unitAssignments.id, { onDelete: "restrict" }),
    status: checkInVerificationStatusEnum().default("VERIFIED").notNull(),
    verifiedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    invalidatedAt: timestamp({ withTimezone: true }),
    invalidatedReason: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("checkin_verifications_booking_status_idx").on(table.bookingId, table.status),
    index("checkin_verifications_facility_verified_idx").on(table.facilityId, table.verifiedAt),
  ],
);

export type CheckInVerification = typeof checkInVerifications.$inferSelect;
export type NewCheckInVerification = typeof checkInVerifications.$inferInsert;
