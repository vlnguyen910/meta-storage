import {
  SUPPORT_CATEGORIES,
  SUPPORT_MESSAGE_KINDS,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
} from "@metastorage/contracts/support";
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { facilities } from "./facilities";
import { payments } from "./payments";
import { rentals } from "./rentals";
import { storageUnits } from "./storage-units";
import { users } from "./users";

export const supportCategoryEnum = pgEnum("support_category", SUPPORT_CATEGORIES);
export const supportStatusEnum = pgEnum("support_status", SUPPORT_STATUSES);
export const supportPriorityEnum = pgEnum("support_priority", SUPPORT_PRIORITIES);
export const supportMessageKindEnum = pgEnum("support_message_kind", SUPPORT_MESSAGE_KINDS);
export const supportClosureEnum = pgEnum("support_closure_kind", ["RESOLVED", "CUSTOMER_WITHDREW"]);
const at = () => timestamp({ precision: 3, withTimezone: true });

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    ownerUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    rentalId: uuid().references(() => rentals.id, { onDelete: "restrict" }),
    storageUnitId: uuid().references(() => storageUnits.id, { onDelete: "restrict" }),
    paymentId: uuid().references(() => payments.id, { onDelete: "restrict" }),
    category: supportCategoryEnum().notNull(),
    subject: varchar({ length: 200 }).notNull(),
    status: supportStatusEnum().default("OPEN").notNull(),
    priority: supportPriorityEnum().default("NORMAL").notNull(),
    assignedStaffId: uuid().references(() => users.id, { onDelete: "restrict" }),
    assignedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    assignedAt: at(),
    assignmentVersion: integer().default(0).notNull(),
    version: integer().default(0).notNull(),
    firstAssignedAt: at(),
    firstOnsiteStartedAt: at(),
    firstBomResponseAt: at(),
    actionDueAt: at().notNull(),
    closedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    closedAt: at(),
    closureKind: supportClosureEnum(),
    closeReason: text(),
    createdAt: at().defaultNow().notNull(),
    updatedAt: at().defaultNow().notNull(),
  },
  (t) => [
    index("support_tickets_owner_idx").on(t.ownerUserId, t.createdAt, t.id),
    index("support_tickets_facility_idx").on(t.facilityId, t.category, t.status, t.createdAt, t.id),
    index("support_tickets_staff_idx").on(t.assignedStaffId, t.status, t.createdAt, t.id),
    index("support_tickets_queue_idx").on(t.category, t.status, t.priority, t.actionDueAt, t.id),
    check("support_ticket_versions_valid", sql`${t.version} >= 0 AND ${t.assignmentVersion} >= 0`),
    check("support_ticket_subject_valid", sql`length(btrim(${t.subject})) BETWEEN 1 AND 200`),
    check(
      "support_ticket_context_valid",
      sql`${t.category} = 'PAYMENT' OR (${t.rentalId} IS NOT NULL AND ${t.storageUnitId} IS NOT NULL AND ${t.paymentId} IS NULL)`,
    ),
    check(
      "support_ticket_assignment_valid",
      sql`(${t.assignedStaffId} IS NULL AND ${t.assignedBy} IS NULL AND ${t.assignedAt} IS NULL) OR (${t.assignedStaffId} IS NOT NULL AND ${t.assignedBy} IS NOT NULL AND ${t.assignedAt} IS NOT NULL)`,
    ),
    check(
      "support_ticket_progress_valid",
      sql`${t.status} != 'IN_PROGRESS' OR ${t.category} = 'PAYMENT' OR ${t.assignedStaffId} IS NOT NULL`,
    ),
    check(
      "support_ticket_closure_valid",
      sql`(${t.status} = 'CLOSED' AND ${t.closedBy} IS NOT NULL AND ${t.closedAt} IS NOT NULL AND ${t.closureKind} IS NOT NULL AND ${t.closeReason} IS NOT NULL AND length(btrim(${t.closeReason})) > 0) OR (${t.status} != 'CLOSED' AND ${t.closedBy} IS NULL AND ${t.closedAt} IS NULL AND ${t.closureKind} IS NULL AND ${t.closeReason} IS NULL)`,
    ),
  ],
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: uuid().defaultRandom().primaryKey(),
    ticketId: uuid()
      .notNull()
      .references(() => supportTickets.id, { onDelete: "restrict" }),
    authorId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    kind: supportMessageKindEnum().notNull(),
    content: text().notNull(),
    createdAt: at().defaultNow().notNull(),
  },
  (t) => [
    unique("support_messages_ticket_id_unique").on(t.ticketId, t.id),
    index("support_messages_cursor_idx").on(t.ticketId, t.createdAt, t.id),
    check("support_message_content_valid", sql`length(btrim(${t.content})) BETWEEN 1 AND 5000`),
  ],
);

export const supportAttachments = pgTable(
  "support_attachments",
  {
    id: uuid().defaultRandom().primaryKey(),
    ticketId: uuid()
      .notNull()
      .references(() => supportTickets.id, { onDelete: "restrict" }),
    messageId: uuid().notNull(),
    uploadedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    objectKey: text().notNull().unique(),
    originalFilename: varchar({ length: 120 }).notNull(),
    mimeType: varchar({ length: 32 }).notNull(),
    byteSize: integer().notNull(),
    checksum: varchar({ length: 64 }).notNull(),
    createdAt: at().defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: "support_attachments_message_fk",
      columns: [t.ticketId, t.messageId],
      foreignColumns: [supportMessages.ticketId, supportMessages.id],
    }).onDelete("restrict"),
    index("support_attachments_ticket_idx").on(t.ticketId, t.messageId),
    check("support_image_bytes_valid", sql`${t.byteSize} BETWEEN 1 AND 5242880`),
    check(
      "support_image_mime_valid",
      sql`${t.mimeType} IN ('image/jpeg', 'image/png', 'image/webp')`,
    ),
    check("support_image_checksum_valid", sql`length(${t.checksum}) = 64`),
  ],
);

export const supportAudit = pgTable(
  "support_audit",
  {
    id: uuid().defaultRandom().primaryKey(),
    ticketId: uuid()
      .notNull()
      .references(() => supportTickets.id, { onDelete: "restrict" }),
    actorId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    action: text().notNull(),
    previousVersion: integer(),
    nextVersion: integer().notNull(),
    oldStatus: supportStatusEnum(),
    newStatus: supportStatusEnum(),
    previousStaffId: uuid().references(() => users.id, { onDelete: "restrict" }),
    nextStaffId: uuid().references(() => users.id, { onDelete: "restrict" }),
    assignmentVersion: integer(),
    reason: text(),
    details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: at().defaultNow().notNull(),
  },
  (t) => [
    index("support_audit_ticket_idx").on(t.ticketId, t.occurredAt, t.id),
    check("support_audit_version_valid", sql`${t.nextVersion} >= 0`),
  ],
);

export const supportIdempotency = pgTable(
  "support_idempotency",
  {
    actorId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    operation: text().notNull(),
    idempotencyKey: varchar({ length: 128 }).notNull(),
    requestHash: varchar({ length: 64 }).notNull(),
    ticketId: uuid().references(() => supportTickets.id, { onDelete: "restrict" }),
    resultReference: jsonb().$type<{
      ticketId: string;
      messageId?: string;
      attachmentId?: string;
    }>(),
    createdAt: at().defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.actorId, t.operation, t.idempotencyKey] })],
);

export type SupportTicketRow = typeof supportTickets.$inferSelect;
export type SupportAttachmentRow = typeof supportAttachments.$inferSelect;
