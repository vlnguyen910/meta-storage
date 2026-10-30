import { sql } from "drizzle-orm";
import { check, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { enumToPgEnum } from "../enum-to-pg-enum";
import { bookings } from "./bookings";
import { facilityTasks } from "./facility-tasks";
import { rentals } from "./rentals";
import { reservations } from "./reservations";
import { storageUnits } from "./storage-units";
import { users } from "./users";

export enum InspectionType {
  CHECK_IN = "CHECK_IN",
  CHECK_OUT = "CHECK_OUT",
  MAINTENANCE = "MAINTENANCE",
}
export enum InspectionStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  PASSED = "PASSED",
  FAILED = "FAILED",
}
export enum InspectionCondition {
  GOOD = "GOOD",
  MINOR_DAMAGE = "MINOR_DAMAGE",
  MAJOR_DAMAGE = "MAJOR_DAMAGE",
}
export const inspectionTypeEnum = pgEnum("inspection_type", enumToPgEnum(InspectionType));
export const inspectionStatusEnum = pgEnum("inspection_status", enumToPgEnum(InspectionStatus));
export const inspectionConditionEnum = pgEnum(
  "inspection_condition",
  enumToPgEnum(InspectionCondition),
);

export const inspections = pgTable(
  "inspections",
  {
    id: uuid().defaultRandom().primaryKey(),
    storageUnitId: uuid()
      .notNull()
      .references(() => storageUnits.id, { onDelete: "restrict" }),
    rentalId: uuid().references(() => rentals.id, { onDelete: "restrict" }),
    bookingId: uuid().references(() => bookings.id, { onDelete: "restrict" }),
    reservationId: uuid().references(() => reservations.id, { onDelete: "restrict" }),
    inspectedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    taskId: uuid()
      .notNull()
      .references(() => facilityTasks.id, { onDelete: "restrict" }),
    inspectionType: inspectionTypeEnum().notNull(),
    status: inspectionStatusEnum().default(InspectionStatus.PENDING).notNull(),
    condition: inspectionConditionEnum(),
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
      "inspections_context_valid",
      sql`(
        (${t.inspectionType} = 'CHECK_IN' AND num_nonnulls(${t.bookingId}, ${t.reservationId}) = 1 AND ${t.rentalId} IS NULL) OR
        (${t.inspectionType} = 'CHECK_OUT' AND ${t.rentalId} IS NOT NULL AND ${t.bookingId} IS NULL AND ${t.reservationId} IS NULL) OR
        (${t.inspectionType} = 'MAINTENANCE' AND ${t.bookingId} IS NULL AND ${t.reservationId} IS NULL)
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
