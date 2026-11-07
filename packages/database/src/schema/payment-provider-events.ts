import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { payments } from "./payments";

export const PAYMENT_PROVIDER_EVENT_STATUSES = ["PROCESSED", "IGNORED", "FAILED"] as const;
export const paymentProviderEventStatusEnum = pgEnum(
  "payment_provider_event_status",
  PAYMENT_PROVIDER_EVENT_STATUSES,
);

export const paymentProviderEvents = pgTable(
  "payment_provider_events",
  {
    id: uuid().defaultRandom().primaryKey(),
    provider: varchar({ length: 32 }).notNull(),
    providerEventId: varchar({ length: 128 }).notNull(),
    paymentId: uuid().references(() => payments.id, { onDelete: "set null" }),
    paymentCode: varchar({ length: 32 }).notNull(),
    amount: integer().notNull(),
    transferType: varchar({ length: 16 }).notNull(),
    referenceCode: varchar({ length: 128 }),
    status: paymentProviderEventStatusEnum().notNull(),
    payloadMetadata: jsonb(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("payment_provider_events_provider_event_idx").on(
      table.provider,
      table.providerEventId,
    ),
    index("payment_provider_events_payment_idx").on(table.paymentId),
  ],
);

export type PaymentProviderEvent = typeof paymentProviderEvents.$inferSelect;
export type NewPaymentProviderEvent = typeof paymentProviderEvents.$inferInsert;
