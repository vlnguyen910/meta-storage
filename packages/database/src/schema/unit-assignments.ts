import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { reservations } from "./reservations";
import { storageUnits } from "./storage-units";
import { users } from "./users";

export const UNIT_ASSIGNMENT_STATUSES = ["ACTIVE", "REASSIGNED", "CANCELLED", "COMPLETED"] as const;
export type UnitAssignmentStatus = (typeof UNIT_ASSIGNMENT_STATUSES)[number];

export const unitAssignments = pgTable(
  "unit_assignments",
  {
    id: uuid().defaultRandom().primaryKey(),
    reservationId: uuid()
      .notNull()
      .references(() => reservations.id, { onDelete: "cascade" }),
    physicalUnitId: uuid()
      .notNull()
      .references(() => storageUnits.id, { onDelete: "restrict" }),
    assignedBy: uuid()
      .notNull()
      .references(() => users.id),
    status: varchar({ length: 50 }).default("ACTIVE").notNull(),
    assignedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp({ withTimezone: true }),
    reason: text(),
  },
  (table) => [
    index("unit_assignments_reservation_idx").on(table.reservationId),
    index("unit_assignments_physical_unit_idx").on(table.physicalUnitId),
    index("unit_assignments_reservation_status_idx").on(table.reservationId, table.status),
  ],
);

export type UnitAssignment = typeof unitAssignments.$inferSelect;
export type NewUnitAssignment = typeof unitAssignments.$inferInsert;
