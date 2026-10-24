import { RenewalStatus } from "@metastorage/contracts/renewals";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { payments } from "./payments";
import { rentalCharges } from "./rental-charges";
import { rentals } from "./rentals";
import { users } from "./users";

export const renewalStatusEnum = pgEnum("renewal_status", RenewalStatus);
export const rentalRenewals = pgTable(
  "rental_renewals",
  {
    id: uuid().defaultRandom().primaryKey(),
    rentalId: uuid()
      .notNull()
      .references(() => rentals.id, { onDelete: "restrict" }),
    customerId: uuid().references(() => users.id, { onDelete: "set null" }),
    rentalVersion: integer().notNull(),
    chargeId: uuid()
      .unique()
      .references(() => rentalCharges.id, { onDelete: "restrict" }),
    paymentId: uuid()
      .unique()
      .references(() => payments.id, { onDelete: "restrict" }),
    idempotencyKey: varchar({ length: 128 }).notNull(),
    status: renewalStatusEnum().default("QUOTED").notNull(),
    months: integer().notNull(),
    oldEndAt: timestamp({ withTimezone: true }).notNull(),
    newEndAt: timestamp({ withTimezone: true }).notNull(),
    monthlyRate: numeric({ precision: 14, scale: 0 }).notNull(),
    amount: numeric({ precision: 14, scale: 0 }).notNull(),
    currency: varchar({ length: 3 }).default("VND").notNull(),
    timezone: text().notNull(),
    cutoffAt: timestamp({ withTimezone: true }).notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    termsVersion: varchar({ length: 128 }).notNull(),
    terms: text().notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
    appliedAt: timestamp({ withTimezone: true }),
    failureReason: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("rental_renewals_request_idx").on(t.rentalId, t.idempotencyKey),
    uniqueIndex("rental_renewals_applied_term_idx")
      .on(t.rentalId, t.rentalVersion)
      .where(sql`${t.status} = 'APPLIED'`),
    index("rental_renewals_history_idx").on(t.rentalId, t.createdAt, t.id),
    check(
      "rental_renewals_period_valid",
      sql`${t.months} between 1 and 12 and ${t.newEndAt} = ${t.oldEndAt} + ${t.months} * interval '720 hours'`,
    ),
    check(
      "rental_renewals_amount_valid",
      sql`${t.monthlyRate} > 0 and ${t.amount} = ${t.monthlyRate} * ${t.months} and ${t.currency} = 'VND'`,
    ),
    check(
      "rental_renewals_deadline_valid",
      sql`${t.expiresAt} > ${t.createdAt} and ${t.expiresAt} <= ${t.createdAt} + interval '15 minutes' and ${t.expiresAt} <= ${t.cutoffAt}`,
    ),
    check("rental_renewals_version_valid", sql`${t.rentalVersion} >= 0`),
    check(
      "rental_renewals_acceptance_valid",
      sql`(${t.chargeId} is null and ${t.acceptedAt} is null and ${t.status} in ('QUOTED', 'EXPIRED')) or (${t.chargeId} is not null and ${t.acceptedAt} is not null and ${t.status} <> 'QUOTED')`,
    ),
    check(
      "rental_renewals_application_valid",
      sql`(${t.status} = 'APPLIED' and ${t.paymentId} is not null and ${t.appliedAt} is not null and ${t.failureReason} is null) or (${t.status} <> 'APPLIED' and ${t.appliedAt} is null)`,
    ),
  ],
);
