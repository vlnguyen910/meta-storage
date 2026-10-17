import { index, integer, pgTable, time, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { facilities } from "./facilities";

export const facilityOperatingHours = pgTable(
  "facility_operating_hours",
  {
    id: uuid().defaultRandom().primaryKey(),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    dayOfWeek: integer().notNull(),
    openTime: time().notNull(),
    closeTime: time().notNull(),
    timezone: varchar({ length: 64 }).default("Asia/Ho_Chi_Minh").notNull(),
  },
  (table) => [
    uniqueIndex("facility_operating_hours_facility_day_idx").on(table.facilityId, table.dayOfWeek),
    index("facility_operating_hours_facility_idx").on(table.facilityId),
  ],
);

export type FacilityOperatingHours = typeof facilityOperatingHours.$inferSelect;
export type NewFacilityOperatingHours = typeof facilityOperatingHours.$inferInsert;
