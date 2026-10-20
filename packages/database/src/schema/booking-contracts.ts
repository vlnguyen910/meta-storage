import {
  type ContractTermsSnapshot,
  RentalDocumentStatus,
} from "@metastorage/contracts/rental-documents";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { users } from "./users";
export const bookingContractStatusEnum = pgEnum("booking_contract_status", RentalDocumentStatus);
export const bookingContracts = pgTable(
  "booking_contracts",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    version: integer().notNull(),
    status: bookingContractStatusEnum().default("UPLOADED").notNull(),
    filename: text().notNull(),
    byteSize: integer().notNull(),
    pageCount: integer().notNull(),
    sha256: text().notNull(),
    objectKey: text().notNull().unique(),
    idempotencyKey: uuid().notNull(),
    uploadedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    uploadedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    issuedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    issuedAt: timestamp({ withTimezone: true }),
    termsSnapshot: jsonb().$type<ContractTermsSnapshot>(),
  },
  (t) => [
    uniqueIndex("booking_contract_version_idx").on(t.bookingId, t.version),
    uniqueIndex("booking_contract_idempotency_idx").on(t.bookingId, t.idempotencyKey),
    check(
      "booking_contract_pdf_valid",
      sql`${t.byteSize} BETWEEN 1 AND 20971520 AND ${t.pageCount} > 0 AND ${t.version} > 0`,
    ),
    check(
      "booking_contract_issue_valid",
      sql`(${t.status} = 'UPLOADED' AND ${t.issuedBy} IS NULL AND ${t.issuedAt} IS NULL AND ${t.termsSnapshot} IS NULL) OR (${t.status} = 'ISSUED' AND ${t.issuedBy} IS NOT NULL AND ${t.issuedAt} IS NOT NULL AND ${t.termsSnapshot} IS NOT NULL)`,
    ),
  ],
);
export const bookingContractAudit = pgTable(
  "booking_contract_audit",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    contractId: uuid()
      .notNull()
      .references(() => bookingContracts.id, { onDelete: "restrict" }),
    actorId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    action: text().notNull(),
    details: jsonb().$type<Record<string, unknown>>().notNull(),
    occurredAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("booking_contract_audit_booking_idx").on(t.bookingId, t.occurredAt)],
);
