import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";

export const BOOKING_EMAIL_STATUSES = ["PENDING", "SENT", "FAILED"] as const;
export const bookingEmailStatusEnum = pgEnum("booking_email_status", BOOKING_EMAIL_STATUSES);

export const bookingConfirmationEmails = pgTable(
  "booking_confirmation_emails",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    recipientEmail: varchar({ length: 320 }).notNull(),
    template: varchar({ length: 80 }).notNull(),
    payload: text(),
    expiresAt: timestamp({ withTimezone: true }),
    status: bookingEmailStatusEnum().default("PENDING").notNull(),
    attempts: integer().default(0).notNull(),
    lastError: text(),
    providerMessageId: varchar({ length: 255 }),
    sentAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("booking_confirmation_email_booking_template_idx").on(
      table.bookingId,
      table.template,
    ),
    index("booking_confirmation_email_status_idx").on(table.status),
  ],
);

export type BookingConfirmationEmail = typeof bookingConfirmationEmails.$inferSelect;
export type NewBookingConfirmationEmail = typeof bookingConfirmationEmails.$inferInsert;
