import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { bookings } from "./bookings";

export const bookingAccessAudit = pgTable(
  "booking_access_audit",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    idempotencyKey: uuid().notNull(),
    action: text().notNull(),
    details: jsonb().$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("booking_access_audit_booking_idx").on(table.bookingId, table.createdAt),
    uniqueIndex("booking_access_audit_idempotency_idx").on(table.bookingId, table.idempotencyKey),
  ],
);
