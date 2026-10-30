import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { enumToPgEnum } from "../enum-to-pg-enum";
import { returnSettlements } from "./return-settlements";

export enum DebtStatus {
  UNPAID = "UNPAID",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  PAID = "PAID",
}
export const debtStatusEnum = pgEnum("debt_status", enumToPgEnum(DebtStatus));
export const debts = pgTable(
  "debts",
  {
    id: uuid().defaultRandom().primaryKey(),
    settlementId: uuid()
      .notNull()
      .unique()
      .references((): AnyPgColumn => returnSettlements.id, { onDelete: "restrict" }),
    originalAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    paidAmount: numeric({ precision: 14, scale: 2 }).default("0").notNull(),
    status: debtStatusEnum().default(DebtStatus.UNPAID).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "debts_amounts_valid",
      sql`${table.originalAmount} > 0 AND ${table.paidAmount} >= 0 AND ${table.paidAmount} <= ${table.originalAmount}`,
    ),
    check(
      "debts_status_valid",
      sql`(${table.paidAmount} = 0 AND ${table.status} = 'UNPAID') OR (${table.paidAmount} > 0 AND ${table.paidAmount} < ${table.originalAmount} AND ${table.status} = 'PARTIALLY_PAID') OR (${table.paidAmount} = ${table.originalAmount} AND ${table.status} = 'PAID')`,
    ),
  ],
);
