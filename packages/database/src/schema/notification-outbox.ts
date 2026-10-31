import type { BookingEmailSnapshot } from "@metastorage/contracts";
import {
  LifecycleNotificationEvent,
  NotificationDeliveryStatus,
} from "@metastorage/contracts/lifecycle-notifications";
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
import { facilities } from "./facilities";
import { reservations } from "./reservations";
import { supportTickets } from "./support";
import { users } from "./users";

export const lifecycleNotificationEventEnum = pgEnum(
  "lifecycle_notification_event",
  LifecycleNotificationEvent,
);
export const notificationDeliveryStatusEnum = pgEnum(
  "notification_delivery_status",
  NotificationDeliveryStatus,
);
export const notificationOutbox = pgTable(
  "notification_outbox",
  {
    id: uuid().defaultRandom().primaryKey(),
    eventKey: text().notNull(),
    recipientKey: text().notNull(),
    eventType: lifecycleNotificationEventEnum().notNull(),
    supportTicketId: uuid().references(() => supportTickets.id, { onDelete: "restrict" }),
    reservationId: uuid().references(() => reservations.id, { onDelete: "restrict" }),
    bookingId: uuid().references(() => bookings.id, { onDelete: "restrict" }),
    rentalTermVersion: integer(),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    recipientUserId: uuid().references(() => users.id, { onDelete: "restrict" }),
    recipientRole: text().notNull(),
    recipientEmail: text().notNull(),
    subject: text().notNull(),
    body: text().notNull(),
    bookingEmail: jsonb().$type<BookingEmailSnapshot>(),
    mailPayload: text(),
    mailExpiresAt: timestamp({ withTimezone: true }),
    queuedAt: timestamp({ withTimezone: true }),
    occurredAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    status: notificationDeliveryStatusEnum().default("PENDING").notNull(),
    attempts: integer().default(0).notNull(),
    nextAttemptAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    firstAttemptAt: timestamp({ withTimezone: true }),
    leaseToken: uuid(),
    leaseUntil: timestamp({ withTimezone: true }),
    providerMessageId: text(),
    sentAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check(
      "notification_outbox_reference_valid",
      sql`num_nonnulls(${t.bookingId}, ${t.reservationId}) = 1`,
    ),
    uniqueIndex("notification_outbox_event_recipient_idx").on(t.eventKey, t.recipientKey),
    index("notification_outbox_dispatch_idx").on(t.status, t.nextAttemptAt),
    index("notification_outbox_inbox_idx").on(t.recipientUserId, t.occurredAt),
  ],
);
