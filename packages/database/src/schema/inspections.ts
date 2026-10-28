import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { facilityTasks } from "./facility-tasks";
import { rentals } from "./rentals";
import { storageUnits } from "./storage-units";
import { users } from "./users";

export const inspections = pgTable(
  "inspections",
  {
    id: uuid().defaultRandom().primaryKey(),
    storageUnitId: uuid()
      .notNull()
      .references(() => storageUnits.id, { onDelete: "restrict" }),
    rentalId: uuid().references(() => rentals.id, { onDelete: "restrict" }),
    bookingId: uuid().references(() => bookings.id, { onDelete: "restrict" }),
    inspectedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    taskId: uuid()
      .notNull()
      .references(() => facilityTasks.id, { onDelete: "restrict" }),
    inspectionType: varchar({ length: 20 }).notNull(),
    status: varchar({ length: 20 }).default("PENDING").notNull(),
    condition: varchar({ length: 20 }),
    checklist: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    notes: text(),
    inspectedAt: timestamp({ withTimezone: true }),
    inspectDoneAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("inspections_unit_idx").on(t.storageUnitId, t.inspectDoneAt),
    index("inspections_rental_idx").on(t.rentalId, t.inspectDoneAt),
    index("inspections_task_idx").on(t.taskId),
    check(
      "inspections_type_valid",
      sql`${t.inspectionType} IN ('CHECK_IN', 'CHECK_OUT', 'MAINTENANCE')`,
    ),
    check(
      "inspections_status_valid",
      sql`${t.status} IN ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED')`,
    ),
    check(
      "inspections_condition_valid",
      sql`${t.condition} IS NULL OR ${t.condition} IN ('GOOD', 'MINOR_DAMAGE', 'MAJOR_DAMAGE')`,
    ),
    check(
      "inspections_context_valid",
      sql`(
        (${t.inspectionType} = 'CHECK_IN' AND ${t.bookingId} IS NOT NULL AND ${t.rentalId} IS NULL) OR
        (${t.inspectionType} = 'CHECK_OUT' AND ${t.rentalId} IS NOT NULL AND ${t.bookingId} IS NULL) OR
        (${t.inspectionType} = 'MAINTENANCE' AND ${t.bookingId} IS NULL)
      )`,
    ),
    check(
      "inspections_completion_valid",
      sql`(${t.status} = 'PENDING' AND ${t.inspectedAt} IS NULL AND ${t.inspectDoneAt} IS NULL) OR (${t.status} = 'IN_PROGRESS' AND ${t.inspectedAt} IS NOT NULL AND ${t.inspectDoneAt} IS NULL) OR (${t.status} IN ('PASSED', 'FAILED') AND ${t.inspectedAt} IS NOT NULL AND ${t.inspectDoneAt} IS NOT NULL)`,
    ),
  ],
);

export type Inspection = typeof inspections.$inferSelect;
export type NewInspection = typeof inspections.$inferInsert;
