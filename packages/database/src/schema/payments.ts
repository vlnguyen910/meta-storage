import {
  PAYMENT_REFUND_REASONS,
  type PaymentRefundReason,
  PaymentStatus,
} from "@metastorage/contracts/payments";
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
import { enumToPgEnum } from "../enum-to-pg-enum";
import { bookings } from "./bookings";
import { users } from "./users";

export {
  PAYMENT_REFUND_REASONS,
  PAYMENT_STATUSES,
  PaymentStatus,
} from "@metastorage/contracts/payments";
export type { PaymentRefundReason };
export const paymentStatusEnum = pgEnum("payment_status", enumToPgEnum(PaymentStatus));
export const paymentRefundReasonEnum = pgEnum(
  "payment_refund_reason_code",
  enumToPgEnum(PAYMENT_REFUND_REASONS),
);

export const payments = pgTable(
  "payments",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    holdTokenHash: varchar({ length: 128 }).notNull(),
    provider: varchar({ length: 32 }).notNull(),
    paymentCode: varchar({ length: 32 }).notNull().unique(),
    providerPaymentId: varchar({ length: 128 }).notNull(),
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
    uniqueIndex("payments_provider_payment_idx").on(table.provider, table.providerPaymentId),
    uniqueIndex("payments_idempotency_idx").on(table.idempotencyKey),
    index("payments_booking_idx").on(table.bookingId),
  ],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
