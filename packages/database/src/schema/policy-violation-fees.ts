import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const policyViolationFees = pgTable(
  "policy_violation_fee",
  {
    id: uuid().defaultRandom().primaryKey(),
    referenceType: varchar({ length: 32 }),
    referenceId: uuid(),
    violationCode: varchar({ length: 64 }).notNull(),
    violationName: varchar({ length: 200 }).notNull(),
    amount: integer().notNull(),
    policyVersion: integer().notNull(),
    note: text(),
    isActive: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check("policy_violation_fee_amount_valid", sql`${t.amount} >= 0`),
    check("policy_violation_fee_version_valid", sql`${t.policyVersion} >= 0`),
    check(
      "policy_violation_fee_reference_valid",
      sql`(${t.referenceType} IS NULL AND ${t.referenceId} IS NULL) OR (${t.referenceType} IS NOT NULL AND ${t.referenceId} IS NOT NULL AND ${t.isActive} = false)`,
    ),
    uniqueIndex("policy_violation_fee_reference_code_idx")
      .on(t.referenceType, t.referenceId, t.violationCode)
      .where(sql`${t.referenceId} IS NOT NULL`),
    uniqueIndex("policy_violation_fee_catalog_code_idx")
      .on(t.violationCode)
      .where(sql`${t.referenceId} IS NULL`),
    index("policy_violation_fee_reference_idx")
      .on(t.referenceType, t.referenceId)
      .where(sql`${t.referenceId} IS NOT NULL`),
  ],
);

export type PolicyViolationFee = typeof policyViolationFees.$inferSelect;
export type NewPolicyViolationFee = typeof policyViolationFees.$inferInsert;
