import { PAYMENT_REFUND_REASONS, PaymentStatus } from "@metastorage/contracts/payments";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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
import { enumToPgEnum } from "../enum-to-pg-enum";
import { bookings } from "./bookings";
import { rentals } from "./rentals";
import { reservations } from "./reservations";
import { users } from "./users";

export type { PaymentRefundReason } from "@metastorage/contracts/payments";
export {
  PAYMENT_REFUND_REASONS,
  PAYMENT_STATUSES,
  PaymentStatus,
} from "@metastorage/contracts/payments";
export const paymentStatusEnum = pgEnum("payment_status", enumToPgEnum(PaymentStatus));
export const paymentRefundReasonEnum = pgEnum(
  "payment_refund_reason_code",
  enumToPgEnum(PAYMENT_REFUND_REASONS),
);
export enum PaymentType {
  CHARGE = "CHARGE",
  DEPOSIT_REFUND = "DEPOSIT_REFUND",
}
export const paymentTypeEnum = pgEnum("payment_type", enumToPgEnum(PaymentType));

export const payments = pgTable(
  "payments",
  {
    id: uuid().defaultRandom().primaryKey(),
    type: paymentTypeEnum().default(PaymentType.CHARGE).notNull(),
    bookingId: uuid().references(() => bookings.id, { onDelete: "restrict" }),
    reservationId: uuid().references(() => reservations.id, { onDelete: "restrict" }),
    rentalId: uuid().references(() => rentals.id, { onDelete: "restrict" }),
    sourcePaymentId: uuid().references((): AnyPgColumn => payments.id, { onDelete: "restrict" }),
    holdTokenHash: varchar({ length: 128 }),
    provider: varchar({ length: 32 }),
    paymentCode: varchar({ length: 32 }).unique(),
    providerPaymentId: varchar({ length: 128 }),
    idempotencyKey: varchar({ length: 128 }).notNull(),
    totalAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    currency: varchar({ length: 3 }).notNull(),
    status: paymentStatusEnum().notNull(),
    paidAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }),
    refundReason: paymentRefundReasonEnum(),
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
      "payments_context_valid",
      sql`(${table.type} = 'CHARGE' AND num_nonnulls(${table.bookingId}, ${table.reservationId}) = 1 AND ${table.rentalId} IS NULL AND ${table.sourcePaymentId} IS NULL AND ${table.provider} IS NOT NULL AND ${table.paymentCode} IS NOT NULL AND ${table.providerPaymentId} IS NOT NULL AND ${table.holdTokenHash} IS NOT NULL) OR (${table.type} = 'DEPOSIT_REFUND' AND num_nonnulls(${table.bookingId}, ${table.reservationId}) <= 1 AND ${table.rentalId} IS NOT NULL AND ${table.sourcePaymentId} IS NOT NULL AND ${table.provider} IS NULL AND ${table.paymentCode} IS NULL AND ${table.providerPaymentId} IS NULL AND ${table.holdTokenHash} IS NULL AND ${table.status} IN ('REFUND_PENDING', 'REFUNDED'))`,
    ),
    check(
      "payments_refund_amount_valid",
      sql`${table.refundAmount} IS NULL OR (${table.refundAmount} >= 0 AND ${table.refundAmount} <= ${table.totalAmount})`,
    ),
    check(
      "payments_deposit_forfeited_valid",
      sql`${table.depositForfeitedAmount} >= 0 AND ${table.depositForfeitedAmount} <= ${table.totalAmount}
        AND (${table.refundAmount} IS NULL OR ${table.refundAmount} + ${table.depositForfeitedAmount} <= ${table.totalAmount})`,
    ),
    uniqueIndex("payments_provider_payment_idx").on(table.provider, table.providerPaymentId),
    uniqueIndex("payments_idempotency_idx").on(table.idempotencyKey),
    uniqueIndex("payments_rental_refund_idx")
      .on(table.rentalId)
      .where(sql`${table.type} = 'DEPOSIT_REFUND'`),
    index("payments_booking_idx").on(table.bookingId),
  ],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
