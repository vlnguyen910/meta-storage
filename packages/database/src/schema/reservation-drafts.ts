import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { facilities } from "./facilities";
import { facilityUnitTypes } from "./facility-unit-types";

export const RESERVATION_DRAFT_STATUSES = ["DRAFT"] as const;
export const RESERVATION_PRICING_STATUSES = ["PRICING_NOT_CONFIGURED", "PRICED"] as const;

export const reservationDraftStatusEnum = pgEnum(
  "reservation_draft_status",
  RESERVATION_DRAFT_STATUSES,
);
export const reservationPricingStatusEnum = pgEnum(
  "reservation_pricing_status",
  RESERVATION_PRICING_STATUSES,
);

export const reservationDrafts = pgTable(
  "reservation_drafts",
  {
    id: uuid().defaultRandom().primaryKey(),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    unitTypeId: uuid().notNull(),
    checkInAt: timestamp({ withTimezone: true }).notNull(),
    rentalEndAt: timestamp({ withTimezone: true }).notNull(),
    durationMonths: integer().notNull(),
    contactName: varchar({ length: 150 }).notNull(),
    contactEmail: varchar({ length: 320 }).notNull(),
    contactPhone: varchar({ length: 32 }).notNull(),
    accessTokenHash: varchar({ length: 128 }),
    status: reservationDraftStatusEnum().default("DRAFT").notNull(),
    pricingStatus: reservationPricingStatusEnum().default("PRICING_NOT_CONFIGURED").notNull(),
    pricing: jsonb().$type<{
      monthlyRateSnapshot: string;
      rentalFeeAmount: string;
      depositAmount: string;
      totalAmount: string;
      currency: string;
    }>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.facilityId, table.unitTypeId],
      foreignColumns: [facilityUnitTypes.facilityId, facilityUnitTypes.unitTypeId],
    }).onDelete("restrict"),
    index("reservation_drafts_facility_idx").on(table.facilityId),
    index("reservation_drafts_unit_type_idx").on(table.unitTypeId),
  ],
);

export type ReservationDraft = typeof reservationDrafts.$inferSelect;
export type NewReservationDraft = typeof reservationDrafts.$inferInsert;
