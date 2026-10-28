import {
  RentalChargeAdjustmentDirection,
  RentalChargeEventType,
  RentalChargeRefundStatus,
} from "@metastorage/contracts/rental-charges";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { payments } from "./payments";
import { rentalCharges } from "./rental-charges";
import { users } from "./users";

export const rentalChargeAdjustmentDirectionEnum = pgEnum(
  "rental_charge_adjustment_direction",
  RentalChargeAdjustmentDirection,
);
export const rentalChargeEventTypeEnum = pgEnum("rental_charge_event_type", RentalChargeEventType);
export const rentalChargeRefundStatusEnum = pgEnum(
  "rental_charge_refund_status",
  RentalChargeRefundStatus,
);

export const rentalChargeAdjustments = pgTable(
  "rental_charge_adjustments",
  {
    id: uuid().defaultRandom().primaryKey(),
    chargeId: uuid()
      .notNull()
      .references(() => rentalCharges.id, { onDelete: "restrict" }),
    direction: rentalChargeAdjustmentDirectionEnum().notNull(),
    amount: numeric({ precision: 14, scale: 0 }).notNull(),
    reason: text().notNull(),
    createdBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("rental_charge_adjustments_charge_idx").on(t.chargeId, t.createdAt, t.id),
    check("rental_charge_adjustments_amount_positive", sql`${t.amount} > 0`),
    check("rental_charge_adjustments_reason_nonempty", sql`length(trim(${t.reason})) > 0`),
  ],
);

export const rentalChargeEvents = pgTable(
  "rental_charge_events",
  {
    id: uuid().defaultRandom().primaryKey(),
    chargeId: uuid()
      .notNull()
      .references(() => rentalCharges.id, { onDelete: "restrict" }),
    type: rentalChargeEventTypeEnum().notNull(),
    actorId: uuid().references(() => users.id, { onDelete: "restrict" }),
    reason: text(),
    details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("rental_charge_events_charge_idx").on(t.chargeId, t.createdAt, t.id)],
);

export const rentalChargeRefunds = pgTable(
  "rental_charge_refunds",
  {
    id: uuid().defaultRandom().primaryKey(),
    chargeId: uuid()
      .notNull()
      .references(() => rentalCharges.id, { onDelete: "restrict" }),
    paymentId: uuid()
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    amount: numeric({ precision: 14, scale: 0 }).notNull(),
    reason: text().notNull(),
    status: rentalChargeRefundStatusEnum().default("PENDING").notNull(),
    reference: text(),
    confirmedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    confirmedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("rental_charge_refunds_charge_idx").on(t.chargeId, t.createdAt, t.id),
    index("rental_charge_refunds_status_idx").on(t.status, t.createdAt),
    uniqueIndex("rental_charge_refunds_reference_idx").on(t.paymentId, t.reference),
    check("rental_charge_refunds_amount_positive", sql`${t.amount} > 0`),
    check("rental_charge_refunds_reason_nonempty", sql`length(trim(${t.reason})) > 0`),
    check(
      "rental_charge_refunds_confirmation_valid",
      sql`(${t.status} = 'PENDING' AND ${t.reference} IS NULL AND ${t.confirmedAt} IS NULL AND ${t.confirmedBy} IS NULL) OR (${t.status} = 'CONFIRMED' AND ${t.reference} IS NOT NULL AND ${t.confirmedAt} IS NOT NULL AND ${t.confirmedBy} IS NOT NULL) OR (${t.status} = 'CANCELLED' AND ${t.reference} IS NULL)`,
    ),
  ],
);

export type RentalChargeAdjustment = typeof rentalChargeAdjustments.$inferSelect;
export type RentalChargeEvent = typeof rentalChargeEvents.$inferSelect;
export type RentalChargeRefund = typeof rentalChargeRefunds.$inferSelect;
