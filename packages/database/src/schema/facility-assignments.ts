import { sql } from "drizzle-orm";
import { boolean, index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { facilities } from "./facilities";
import { roleEnum, users } from "./users";

export const FACILITY_ROLES = ["FACILITY_STAFF", "FACILITY_MANAGER"] as const;
export type FacilityRole = (typeof FACILITY_ROLES)[number];

export const facilityAssignments = pgTable(
  "facility_assignments",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    assignedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp({ withTimezone: true }),
    isActive: boolean().default(true).notNull(),
    role: roleEnum().notNull(),
  },
  (table) => [
    uniqueIndex("facility_assignments_user_facility_idx").on(table.userId, table.facilityId),
    uniqueIndex("facility_assignments_active_user_idx")
      .on(table.userId)
      .where(sql`${table.isActive} = true`),
    index("facility_assignments_facility_idx").on(table.facilityId),
  ],
);

export type FacilityAssignment = typeof facilityAssignments.$inferSelect;
export type NewFacilityAssignment = typeof facilityAssignments.$inferInsert;
