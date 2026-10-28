import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { enumToPgEnum } from "../enum-to-pg-enum";
import { SupportCategory } from "./enums";
import { facilities } from "./facilities";
import { payments } from "./payments";
import { rentals } from "./rentals";
import { reservations } from "./reservations";
import { users } from "./users";

export const supportCategoryEnum = pgEnum("support_category", enumToPgEnum(SupportCategory));
const at = () => timestamp({ precision: 3, withTimezone: true });

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid().defaultRandom().primaryKey(),
    reservationId: uuid()
      .notNull()
      .references(() => reservations.id, { onDelete: "restrict" }),
    ownerUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    rentalId: uuid().references(() => rentals.id, { onDelete: "restrict" }),
    paymentId: uuid().references(() => payments.id, { onDelete: "restrict" }),
    category: supportCategoryEnum().notNull(),
    subject: varchar({ length: 200 }).notNull(),
    description: text().notNull(),
    actionDueAt: at().notNull(),
    idempotencyKey: varchar({ length: 128 }).notNull(),
    createdAt: at().defaultNow().notNull(),
  },
  (t) => [
    index("support_tickets_owner_idx").on(t.ownerUserId, t.createdAt, t.id),
    index("support_tickets_facility_idx").on(t.facilityId, t.category, t.createdAt, t.id),
    uniqueIndex("support_tickets_owner_idempotency_idx").on(t.ownerUserId, t.idempotencyKey),
    check("support_ticket_subject_valid", sql`length(btrim(${t.subject})) BETWEEN 1 AND 200`),
    check(
      "support_ticket_description_valid",
      sql`length(btrim(${t.description})) BETWEEN 1 AND 5000`,
    ),
    check(
      "support_ticket_context_valid",
      sql`(${t.category} = 'PAYMENT' AND ${t.rentalId} IS NULL) OR (${t.category} != 'PAYMENT' AND ${t.rentalId} IS NOT NULL AND ${t.paymentId} IS NULL)`,
    ),
    check("support_ticket_due_valid", sql`${t.actionDueAt} > ${t.createdAt}`),
  ],
);

export type SupportTicketRow = typeof supportTickets.$inferSelect;
