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
import { rentalCharges } from "./rental-charges";
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
    rentalChargeId: uuid().references(() => rentalCharges.id, { onDelete: "restrict" }),
    holdTokenHash: varchar({ length: 128 }),
    provider: varchar({ length: 32 }).notNull(),
    paymentCode: varchar({ length: 32 }).notNull().unique(),
    providerPaymentId: varchar({ length: 128 }).notNull(),
    idempotencyKey: varchar({ length: 128 }).notNull(),
    totalAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    currency: varchar({ length: 3 }).notNull(),
    status: paymentStatusEnum().notNull(),
    paidAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }),
    refundReason: varchar({ length: 64 }),
    refundAmount: numeric({ precision: 14, scale: 2 }),
    depositForfeitedAmount: numeric({ precision: 14, scale: 2 }).default("0").notNull(),
    refundReference: varchar({ length: 128 }),
    refundedAt: timestamp({ withTimezone: true }),
    refundedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "payments_refund_amount_valid",
      sql`${table.refundAmount} IS NULL OR (${table.refundAmount} >= 0 AND ${table.refundAmount} <= ${table.totalAmount})`,
    ),
    check(
      "payments_deposit_forfeited_valid",
      sql`${table.depositForfeitedAmount} >= 0 AND ${table.depositForfeitedAmount} <= ${table.totalAmount}
        AND (${table.refundAmount} IS NULL OR ${table.refundAmount} + ${table.depositForfeitedAmount} <= ${table.totalAmount})`,
    ),
    check(
      "payments_source_reference",
      sql`(
        (${table.bookingId} IS NOT NULL AND ${table.draftId} IS NULL AND ${table.rentalChargeId} IS NULL AND ${table.holdTokenHash} IS NOT NULL) OR
        (${table.bookingId} IS NULL AND ${table.draftId} IS NOT NULL AND ${table.rentalChargeId} IS NULL AND ${table.holdTokenHash} IS NOT NULL) OR
        (${table.bookingId} IS NULL AND ${table.draftId} IS NULL AND ${table.rentalChargeId} IS NOT NULL AND ${table.holdTokenHash} IS NULL)
      )`,
    ),
    uniqueIndex("payments_provider_payment_idx").on(table.provider, table.providerPaymentId),
    uniqueIndex("payments_idempotency_idx").on(table.idempotencyKey),
    index("payments_booking_idx").on(table.bookingId),
    index("payments_rental_charge_idx").on(table.rentalChargeId),
    uniqueIndex("payments_pending_rental_charge_idx")
      .on(table.rentalChargeId)
      .where(sql`${table.rentalChargeId} IS NOT NULL AND ${table.status} = 'PENDING'`),
    uniqueIndex("payments_collected_rental_charge_idx")
      .on(table.rentalChargeId)
      .where(sql`${table.rentalChargeId} IS NOT NULL AND ${table.status} = 'SUCCEEDED'`),
  ],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
