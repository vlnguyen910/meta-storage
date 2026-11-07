import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { enumToPgEnum } from "../enum-to-pg-enum";
import { rentals } from "./rentals";
import { storageUnits } from "./storage-units";

export enum RentalRenewalStatus {
  QUOTED = "QUOTED",
  PENDING_PAYMENT = "PENDING_PAYMENT",
  APPLIED = "APPLIED",
  REFUND_REQUIRED = "REFUND_REQUIRED",
}

export const rentalRenewalStatusEnum = pgEnum(
  "rental_renewal_status",
  enumToPgEnum(RentalRenewalStatus),
);

export const rentalRenewals = pgTable(
  "rental_renewals",
  {
    id: uuid().defaultRandom().primaryKey(),
    rentalId: uuid()
      .notNull()
      .references(() => rentals.id, { onDelete: "restrict" }),
    storageUnitId: uuid()
      .notNull()
      .references(() => storageUnits.id, { onDelete: "restrict" }),
    idempotencyKey: varchar({ length: 128 }).notNull(),
    oldEndAt: timestamp({ withTimezone: true }).notNull(),
    newEndAt: timestamp({ withTimezone: true }).notNull(),
    months: integer().notNull(),
    monthlyRateSnapshot: numeric({ precision: 14, scale: 2 }).notNull(),
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    currency: varchar({ length: 3 }).default("VND").notNull(),
    noticeDaysSnapshot: integer().notNull(),
    settingVersionSnapshot: integer().notNull(),
    cutoffAt: timestamp({ withTimezone: true }).notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    status: rentalRenewalStatusEnum().default(RentalRenewalStatus.QUOTED).notNull(),
    appliedAt: timestamp({ withTimezone: true }),
    failureReason: varchar({ length: 64 }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check("rental_renewals_months_valid", sql`${t.months} between 1 and 12`),
    check(
      "rental_renewals_period_valid",
      sql`${t.newEndAt} = ${t.oldEndAt} + ${t.months} * interval '720 hours'`,
    ),
    check(
      "rental_renewals_amount_valid",
      sql`${t.monthlyRateSnapshot} > 0 and ${t.amount} = ${t.monthlyRateSnapshot} * ${t.months} and ${t.currency} = 'VND'`,
    ),
    check(
      "rental_renewals_deadline_valid",
      sql`${t.expiresAt} <= ${t.cutoffAt} and ${t.noticeDaysSnapshot} >= 0`,
    ),
    check("rental_renewals_setting_version_valid", sql`${t.settingVersionSnapshot} >= 0`),
    check(
      "rental_renewals_application_valid",
      sql`(${t.status} = 'APPLIED' and ${t.appliedAt} is not null) or (${t.status} <> 'APPLIED' and ${t.appliedAt} is null)`,
    ),
    index("rental_renewals_history_idx").on(t.rentalId, t.createdAt, t.id),
    uniqueIndex("rental_renewals_idempotency_idx").on(t.rentalId, t.idempotencyKey),
    uniqueIndex("rental_renewals_applied_term_idx")
      .on(t.rentalId, t.oldEndAt)
      .where(sql`${t.status} = 'APPLIED'`),
  ],
);

export type RentalRenewal = typeof rentalRenewals.$inferSelect;
