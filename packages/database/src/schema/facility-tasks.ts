import {
  FacilityTaskReferenceType,
  FacilityTaskStatus,
  FacilityTaskType,
} from "@metastorage/contracts/facility-tasks";
import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { enumToPgEnum } from "../enum-to-pg-enum";
import { facilities } from "./facilities";
import { users } from "./users";

export const facilityTaskTypeEnum = pgEnum("facility_task_type", enumToPgEnum(FacilityTaskType));
export const facilityTaskReferenceTypeEnum = pgEnum(
  "facility_task_reference_type",
  enumToPgEnum(FacilityTaskReferenceType),
);
export const facilityTaskStatusEnum = pgEnum(
  "facility_task_status",
  enumToPgEnum(FacilityTaskStatus),
);
export const facilityTasks = pgTable(
  "facility_tasks",
  {
    id: uuid().defaultRandom().primaryKey(),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    type: facilityTaskTypeEnum().notNull(),
    status: facilityTaskStatusEnum().default(FacilityTaskStatus.ASSIGNED).notNull(),
    referenceType: facilityTaskReferenceTypeEnum().notNull(),
    referenceId: uuid().notNull(),
    description: text(),
    assignedStaffId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    startedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    assignedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("facility_tasks_staff_idx").on(t.facilityId, t.assignedStaffId),
    index("facility_tasks_type_idx").on(t.facilityId, t.type),
    index("facility_tasks_reference_idx").on(t.referenceType, t.referenceId),
    check(
      "facility_tasks_lifecycle_valid",
      sql`(${t.status} = 'ASSIGNED' AND ${t.startedAt} IS NULL AND ${t.completedAt} IS NULL)
        OR (${t.status} = 'IN_PROGRESS' AND ${t.startedAt} IS NOT NULL AND ${t.completedAt} IS NULL)
        OR (${t.status} = 'COMPLETED' AND ${t.startedAt} IS NOT NULL AND ${t.completedAt} IS NOT NULL)
        OR ${t.status} = 'CANCELLED'`,
    ),
    check(
      "facility_tasks_reference_valid",
      sql`(${t.type} = 'CHECK_IN_HANDOVER' AND ${t.referenceType} = 'BOOKING') OR (${t.type} = 'UNIT_INSPECTION' AND ${t.referenceType} IN ('BOOKING', 'STORAGE_UNIT')) OR (${t.type} = 'HANDLE_SUPPORT' AND ${t.referenceType} = 'SUPPORT_TICKET')`,
    ),
  ],
);

export type FacilityTask = typeof facilityTasks.$inferSelect;
