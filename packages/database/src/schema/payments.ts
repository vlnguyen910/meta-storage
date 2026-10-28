import {
  PAYMENT_REFUND_REASONS,
  type PaymentRefundReason,
  PaymentStatus,
} from "@metastorage/contracts/payments";
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
import { rentalCharges } from "./rental-charges";
import { rentals } from "./rentals";
import { users } from "./users";

export {
  PAYMENT_REFUND_REASONS,
  PAYMENT_STATUSES,
  PaymentStatus,
} from "@metastorage/contracts/payments";
export enum PaymentType {
  COLLECTION = "COLLECTION",
  RETURN_REFUND = "RETURN_REFUND",
}
export type { PaymentRefundReason };
export const paymentStatusEnum = pgEnum("payment_status", enumToPgEnum(PaymentStatus));
export const paymentTypeEnum = pgEnum("payment_type", enumToPgEnum(PaymentType));
export const paymentRefundReasonEnum = pgEnum(
  "payment_refund_reason_code",
  enumToPgEnum(PAYMENT_REFUND_REASONS),
);

export const payments = pgTable(
  "payments",
  {
    id: uuid().defaultRandom().primaryKey(),
    type: paymentTypeEnum().default(PaymentType.COLLECTION).notNull(),
    bookingId: uuid().references(() => bookings.id, { onDelete: "restrict" }),
    rentalChargeId: uuid().references(() => rentalCharges.id, { onDelete: "restrict" }),
    rentalId: uuid().references(() => rentals.id, { onDelete: "restrict" }),
    sourcePaymentId: uuid().references((): AnyPgColumn => payments.id, { onDelete: "restrict" }),
    depositRefundAmount: numeric({ precision: 14, scale: 2 }),
    rentRefundAmount: numeric({ precision: 14, scale: 2 }),
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
        (${table.type} = 'COLLECTION' AND ${table.rentalId} IS NULL AND ${table.sourcePaymentId} IS NULL AND ${table.provider} IS NOT NULL AND ${table.paymentCode} IS NOT NULL AND ${table.providerPaymentId} IS NOT NULL AND ((${table.bookingId} IS NOT NULL AND ${table.rentalChargeId} IS NULL AND ${table.holdTokenHash} IS NOT NULL) OR (${table.bookingId} IS NULL AND ${table.rentalChargeId} IS NOT NULL AND ${table.holdTokenHash} IS NULL))) OR
        (${table.type} = 'RETURN_REFUND' AND ${table.bookingId} IS NULL AND ${table.rentalChargeId} IS NULL AND ${table.rentalId} IS NOT NULL AND ${table.sourcePaymentId} IS NOT NULL AND ${table.holdTokenHash} IS NULL AND ${table.provider} IS NULL AND ${table.paymentCode} IS NULL AND ${table.providerPaymentId} IS NULL AND ${table.status} = 'SUCCEEDED' AND ${table.totalAmount} > 0 AND ${table.refundReference} IS NOT NULL AND ${table.refundedAt} IS NOT NULL AND ${table.refundedBy} IS NOT NULL)
      )`,
    ),
    check(
      "payments_refund_allocation_valid",
      sql`(${table.depositRefundAmount} IS NULL AND ${table.rentRefundAmount} IS NULL) OR (${table.depositRefundAmount} >= 0 AND ${table.rentRefundAmount} >= 0 AND ${table.depositRefundAmount} + ${table.rentRefundAmount} = ${table.totalAmount})`,
    ),
    uniqueIndex("payments_provider_payment_idx").on(table.provider, table.providerPaymentId),
    uniqueIndex("payments_refund_reference_idx")
      .on(table.sourcePaymentId, table.refundReference)
      .where(sql`${table.type} = 'RETURN_REFUND'`),
    uniqueIndex("payments_idempotency_idx").on(table.idempotencyKey),
    index("payments_booking_idx").on(table.bookingId),
    index("payments_rental_charge_idx").on(table.rentalChargeId),
    index("payments_rental_idx").on(table.rentalId),
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
