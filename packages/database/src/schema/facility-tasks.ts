import { FacilityTaskType } from "@metastorage/contracts/facility-tasks";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { facilities } from "./facilities";
import { storageUnits } from "./storage-units";
import { users } from "./users";

export const facilityTaskTypeEnum = pgEnum("facility_task_type", FacilityTaskType);
export const facilityTaskStatusEnum = pgEnum("facility_task_status", [
  "ASSIGNED",
  "IN_PROGRESS",
  "AWAITING_APPROVAL",
  "COMPLETED",
]);
export const facilityTasks = pgTable(
  "facility_tasks",
  {
    id: uuid().defaultRandom().primaryKey(),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    type: facilityTaskTypeEnum().notNull(),
    status: facilityTaskStatusEnum().default("ASSIGNED").notNull(),
    title: varchar({ length: 200 }).notNull(),
    description: text(),
    storageUnitId: uuid().references(() => storageUnits.id, { onDelete: "restrict" }),
    bookingId: uuid().references(() => bookings.id, { onDelete: "restrict" }),
    assignedStaffId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    version: integer().default(0).notNull(),
    startedAt: timestamp({ withTimezone: true }),
    completedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    completedAt: timestamp({ withTimezone: true }),
    assignedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("facility_tasks_staff_idx").on(t.facilityId, t.assignedStaffId),
    index("facility_tasks_type_idx").on(t.facilityId, t.type),
    check("facility_tasks_version_valid", sql`${t.version} >= 0`),
    check(
      "facility_tasks_lifecycle_valid",
      sql`(${t.status} = 'ASSIGNED' AND ${t.startedAt} IS NULL AND ${t.completedBy} IS NULL AND ${t.completedAt} IS NULL)
        OR (${t.status} IN ('IN_PROGRESS', 'AWAITING_APPROVAL') AND ${t.startedAt} IS NOT NULL AND ${t.completedBy} IS NULL AND ${t.completedAt} IS NULL)
        OR (${t.status} = 'COMPLETED' AND ${t.startedAt} IS NOT NULL AND ${t.completedBy} IS NOT NULL AND ${t.completedAt} IS NOT NULL)`,
    ),
    check(
      "facility_tasks_text_valid",
      sql`length(btrim(${t.title})) BETWEEN 1 AND 200 AND (${t.description} IS NULL OR length(${t.description}) <= 2000)`,
    ),
  ],
);

export type FacilityTask = typeof facilityTasks.$inferSelect;
