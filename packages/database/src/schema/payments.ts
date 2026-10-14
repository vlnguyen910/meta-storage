import { PaymentStatus } from "@metastorage/contracts/payments";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { reservationDrafts } from "./reservation-drafts";
import { users } from "./users";

export { PAYMENT_STATUSES } from "@metastorage/contracts/payments";
export const paymentStatusEnum = pgEnum("payment_status", PaymentStatus);

export const payments = pgTable(
  "payments",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingId: uuid().references(() => bookings.id, { onDelete: "restrict" }),
    draftId: uuid().references(() => reservationDrafts.id, { onDelete: "restrict" }),
    holdTokenHash: varchar({ length: 128 }).notNull(),
    provider: varchar({ length: 32 }).notNull(),
    paymentCode: varchar({ length: 32 }).notNull().unique(),
    providerPaymentId: varchar({ length: 128 }).notNull(),
    idempotencyKey: varchar({ length: 128 }).notNull(),
    totalAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    currency: varchar({ length: 3 }).notNull(),
    status: paymentStatusEnum().notNull(),
    paidAt: timestamp({ withTimezone: true }),
    refundReason: varchar({ length: 64 }),
    refundReference: varchar({ length: 128 }),
    refundedAt: timestamp({ withTimezone: true }),
    refundedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "payments_checkout_reference",
      sql`${table.bookingId} IS NOT NULL OR ${table.draftId} IS NOT NULL`,
    ),
    uniqueIndex("payments_provider_payment_idx").on(table.provider, table.providerPaymentId),
    uniqueIndex("payments_idempotency_idx").on(table.idempotencyKey),
    index("payments_booking_idx").on(table.bookingId),
  ],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
