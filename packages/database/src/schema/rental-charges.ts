import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { enumToPgEnum } from "../enum-to-pg-enum";
import {
  RentalChargeCategory as ChargeCategory,
  RentalChargeSource as ChargeSource,
  RentalChargeStatus as ChargeStatus,
  type RentalChargeEventType,
} from "./enums";
import { rentals } from "./rentals";
import { users } from "./users";

export const rentalChargeSourceEnum = pgEnum("rental_charge_source", enumToPgEnum(ChargeSource));
export const rentalChargeCategoryEnum = pgEnum(
  "rental_charge_category",
  enumToPgEnum(ChargeCategory),
);
export const rentalChargeStatusEnum = pgEnum("rental_charge_status", enumToPgEnum(ChargeStatus));

export const rentalCharges = pgTable(
  "rental_charges",
  {
    id: uuid().defaultRandom().primaryKey(),
    rentalId: uuid()
      .notNull()
      .references(() => rentals.id, { onDelete: "restrict" }),
    source: rentalChargeSourceEnum().notNull(),
    category: rentalChargeCategoryEnum().notNull(),
    amount: numeric({ precision: 14, scale: 0 }).notNull(),
    currency: varchar({ length: 3 }).default("VND").notNull(),
    evidence: text().notNull(),
    dueDate: date(),
    status: rentalChargeStatusEnum().default(ChargeStatus.PENDING_APPROVAL).notNull(),
    createdBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    approvedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    decisionReason: text(),
    disputedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("rental_charges_rental_created_idx").on(t.rentalId, t.createdAt, t.id),
    index("rental_charges_status_due_idx").on(t.status, t.dueDate),
    check("rental_charges_amount_positive", sql`${t.amount} > 0`),
    check("rental_charges_currency_vnd", sql`${t.currency} = 'VND'`),
    check("rental_charges_evidence_nonempty", sql`length(trim(${t.evidence})) > 0`),
    check(
      "rental_charges_source_category_valid",
      sql`(${t.source} = 'EXTRA' AND ${t.category} IN ('LOCK_REPLACEMENT','KEY_REPLACEMENT','ACCESS_DEVICE_REPLACEMENT','FACILITY_SERVICE','CLEANING')) OR (${t.source} = 'RETURN_DEBT' AND ${t.category} = 'RETURN_DEBT') OR (${t.source} = 'RENEWAL' AND ${t.category} = 'RENEWAL_RENT')`,
    ),
  ],
);

export type RentalCharge = typeof rentalCharges.$inferSelect;
export type NewRentalCharge = typeof rentalCharges.$inferInsert;
export type RentalChargeSourceValue = ChargeSource;
export type RentalChargeCategoryValue = ChargeCategory;
export type RentalChargeStatusValue = ChargeStatus;
export type RentalChargeEventTypeValue = RentalChargeEventType;
