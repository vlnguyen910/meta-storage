import type { ReturnChecklistItem, ReturnChecklistResult } from "@metastorage/contracts/returns";
import {
  ReturnInspectionStatus,
  ReturnRequestStatus,
  ReturnTimeChangeStatus,
} from "@metastorage/contracts/returns";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { checkInSlots } from "./check-in-slots";
import { facilities } from "./facilities";
import { payments } from "./payments";
import { rentals } from "./rentals";
import { users } from "./users";

export const returnRequestStatusEnum = pgEnum("return_request_status", ReturnRequestStatus);
export const returnInspectionStatusEnum = pgEnum(
  "return_inspection_status",
  ReturnInspectionStatus,
);
export const returnTimeChangeStatusEnum = pgEnum(
  "return_time_change_status",
  ReturnTimeChangeStatus,
);

export const returnChecklistVersions = pgTable("return_checklist_versions", {
  id: uuid().defaultRandom().primaryKey(),
  version: integer().notNull().unique(),
  items: jsonb().$type<ReturnChecklistItem[]>().notNull(),
  createdBy: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
export const facilityReturnCalendars = pgTable("facility_return_calendars", {
  facilityId: uuid()
    .primaryKey()
    .references(() => facilities.id, { onDelete: "restrict" }),
  timezone: text().notNull(),
  holidays: jsonb().$type<string[]>().notNull(),
  reminderTime: text().default("09:00").notNull(),
  version: integer().notNull(),
  updatedBy: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
export const returnOverdueSettings = pgTable(
  "return_overdue_settings",
  {
    id: text().primaryKey(),
    rate: integer().default(25).notNull(),
    version: integer().default(0).notNull(),
    updatedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "return_overdue_rate_valid",
      sql`${t.id} = 'default' AND ${t.rate} BETWEEN 0 AND 100 AND ${t.version} >= 0`,
    ),
  ],
);

export const returnRequests = pgTable(
  "return_requests",
  {
    id: uuid().defaultRandom().primaryKey(),
    rentalId: uuid()
      .notNull()
      .references(() => rentals.id, { onDelete: "restrict" }),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    slotId: uuid()
      .notNull()
      .references(() => checkInSlots.id, { onDelete: "restrict" }),
    date: date().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    timezone: text().notNull(),
    status: returnRequestStatusEnum().default("PENDING").notNull(),
    assignedStaffId: uuid().references(() => users.id, { onDelete: "restrict" }),
    version: integer().default(0).notNull(),
    reason: text().notNull(),
    manualReviewRequired: boolean().default(false).notNull(),
    createdBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("return_requests_open_rental_idx")
      .on(t.rentalId)
      .where(sql`${t.status} IN ('PENDING','CONFIRMED','INSPECTING','FAILED')`),
    index("return_requests_facility_slot_idx").on(t.facilityId, t.date, t.slotId),
    uniqueIndex("return_requests_reserved_slot_idx")
      .on(t.facilityId, t.date, t.slotId)
      .where(sql`${t.status} IN ('CONFIRMED','INSPECTING','FAILED')`),
    check("return_request_period_valid", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);
export const returnInspections = pgTable(
  "return_inspections",
  {
    id: uuid().defaultRandom().primaryKey(),
    requestId: uuid()
      .notNull()
      .references(() => returnRequests.id, { onDelete: "restrict" }),
    attempt: integer().notNull(),
    checklistVersionId: uuid()
      .notNull()
      .references(() => returnChecklistVersions.id, { onDelete: "restrict" }),
    definition: jsonb().$type<ReturnChecklistItem[]>().notNull(),
    results: jsonb().$type<ReturnChecklistResult[]>().notNull().default([]),
    status: returnInspectionStatusEnum().default("DRAFT").notNull(),
    version: integer().default(0).notNull(),
    propertyDisposition: text().default("NONE").notNull(),
    propertyReceiver: text(),
    propertyHandledAt: timestamp({ withTimezone: true }),
    propertyEvidencePhotoIds: jsonb().$type<string[]>().notNull().default([]),
    createdBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    completedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("return_inspection_attempt_idx").on(t.requestId, t.attempt)],
);
export const returnInspectionPhotos = pgTable(
  "return_inspection_photos",
  {
    id: uuid().defaultRandom().primaryKey(),
    inspectionId: uuid()
      .notNull()
      .references(() => returnInspections.id, { onDelete: "restrict" }),
    uploadedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    filename: text().notNull(),
    mimeType: text().notNull(),
    byteSize: integer().notNull(),
    publicId: text().notNull(),
    format: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("return_photo_inspection_idx").on(t.inspectionId)],
);
export const returnEvidencePhotos = pgTable(
  "return_evidence_photos",
  {
    id: uuid().defaultRandom().primaryKey(),
    requestId: uuid()
      .notNull()
      .references(() => returnRequests.id, { onDelete: "restrict" }),
    purpose: text().notNull(),
    uploadedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    filename: text().notNull(),
    mimeType: text().notNull(),
    byteSize: integer().notNull(),
    publicId: text().notNull(),
    format: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("return_evidence_request_idx").on(t.requestId)],
);
export const returnTimeChanges = pgTable(
  "return_time_changes",
  {
    id: uuid().defaultRandom().primaryKey(),
    requestId: uuid()
      .notNull()
      .references(() => returnRequests.id, { onDelete: "restrict" }),
    previousAt: timestamp({ withTimezone: true }),
    proposedAt: timestamp({ withTimezone: true }).notNull(),
    reason: text().notNull(),
    evidencePhotoIds: jsonb().$type<string[]>().notNull(),
    idempotencyKey: uuid().notNull(),
    status: returnTimeChangeStatusEnum().default("PENDING").notNull(),
    proposedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    decidedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    decisionReason: text(),
    decidedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("return_time_change_idempotency_idx").on(t.requestId, t.idempotencyKey)],
);
export const returnSettlements = pgTable(
  "return_settlements",
  {
    id: uuid().defaultRandom().primaryKey(),
    requestId: uuid()
      .notNull()
      .references(() => returnRequests.id, { onDelete: "restrict" }),
    revision: integer().notNull(),
    depositSnapshot: numeric({ precision: 14, scale: 0 }).notNull(),
    rateSnapshot: integer().notNull(),
    overdueFeeAmount: numeric({ precision: 14, scale: 0 }).notNull(),
    damageAmount: numeric({ precision: 14, scale: 0 }).notNull(),
    unusedRentRefundAmount: numeric({ precision: 14, scale: 0 }).notNull(),
    refundEntitlement: numeric({ precision: 14, scale: 0 }).notNull(),
    debtAmount: numeric({ precision: 14, scale: 0 }).notNull(),
    actualReturnAt: timestamp({ withTimezone: true }).notNull(),
    refundDueDate: date().notNull(),
    calendarSnapshot: jsonb().$type<{ timezone: string; holidays: string[] }>().notNull(),
    approvedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reason: text().notNull(),
    approvedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("return_settlement_revision_idx").on(t.requestId, t.revision),
    check(
      "return_settlement_amounts_valid",
      sql`${t.depositSnapshot} >= 0 AND ${t.rateSnapshot} BETWEEN 0 AND 100 AND ${t.overdueFeeAmount} >= 0 AND ${t.damageAmount} >= 0 AND ${t.unusedRentRefundAmount} >= 0 AND ${t.refundEntitlement} >= 0 AND ${t.debtAmount} >= 0`,
    ),
  ],
);
export const returnRefunds = pgTable(
  "return_refunds",
  {
    id: uuid().defaultRandom().primaryKey(),
    requestId: uuid()
      .notNull()
      .references(() => returnRequests.id, { onDelete: "restrict" }),
    paymentId: uuid()
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    settlementId: uuid()
      .notNull()
      .references(() => returnSettlements.id, { onDelete: "restrict" }),
    amount: numeric({ precision: 14, scale: 0 }).notNull(),
    depositRefundAmount: numeric({ precision: 14, scale: 0 }),
    rentRefundAmount: numeric({ precision: 14, scale: 0 }),
    reference: text().notNull(),
    evidencePhotoIds: jsonb().$type<string[]>().notNull(),
    idempotencyKey: uuid().notNull(),
    confirmedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    confirmedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("return_refund_idempotency_idx").on(t.requestId, t.idempotencyKey),
    uniqueIndex("return_refund_reference_idx").on(t.paymentId, t.reference),
    check("return_refund_amount_positive", sql`${t.amount} > 0`),
    check(
      "return_refund_allocation_valid",
      sql`(
      (${t.depositRefundAmount} IS NULL AND ${t.rentRefundAmount} IS NULL) OR
      (${t.depositRefundAmount} IS NOT NULL AND ${t.rentRefundAmount} IS NOT NULL AND
       ${t.depositRefundAmount} >= 0 AND ${t.rentRefundAmount} >= 0 AND
       ${t.depositRefundAmount} + ${t.rentRefundAmount} = ${t.amount})
    )`,
    ),
  ],
);
export const returnAudit = pgTable(
  "return_audit",
  {
    id: uuid().defaultRandom().primaryKey(),
    requestId: uuid().references(() => returnRequests.id, { onDelete: "restrict" }),
    facilityId: uuid().references(() => facilities.id, { onDelete: "restrict" }),
    actorId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    action: text().notNull(),
    details: jsonb().$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("return_audit_request_idx").on(t.requestId, t.createdAt)],
);
