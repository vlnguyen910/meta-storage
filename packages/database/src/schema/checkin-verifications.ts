import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { enumToPgEnum } from "../enum-to-pg-enum";
import { facilities } from "./facilities";
import { reservations } from "./reservations";
import { unitAssignments } from "./unit-assignments";
import { users } from "./users";

export enum CheckInVerificationStatus {
  VERIFIED = "VERIFIED",
  CONSUMED = "CONSUMED",
  INVALIDATED = "INVALIDATED",
}
export const checkInVerificationStatusEnum = pgEnum(
  "checkin_verification_status",
  enumToPgEnum(CheckInVerificationStatus),
);

export const checkInVerifications = pgTable(
  "checkin_verifications",
  {
    id: uuid().defaultRandom().primaryKey(),
    reservationId: uuid()
      .notNull()
      .references(() => reservations.id, { onDelete: "restrict" }),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    staffId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    unitAssignmentId: uuid()
      .notNull()
      .references(() => unitAssignments.id, { onDelete: "restrict" }),
    status: checkInVerificationStatusEnum().default(CheckInVerificationStatus.VERIFIED).notNull(),
    verifiedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    invalidatedAt: timestamp({ withTimezone: true }),
    invalidatedReason: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("checkin_verifications_reservation_status_idx").on(table.reservationId, table.status),
    index("checkin_verifications_facility_verified_idx").on(table.facilityId, table.verifiedAt),
  ],
);

export type CheckInVerification = typeof checkInVerifications.$inferSelect;
export type NewCheckInVerification = typeof checkInVerifications.$inferInsert;
