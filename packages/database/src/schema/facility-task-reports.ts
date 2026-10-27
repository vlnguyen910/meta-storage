import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { facilityTasks } from "./facility-tasks";
import { users } from "./users";

export const facilityTaskReports = pgTable(
  "facility_task_reports",
  {
    id: uuid().defaultRandom().primaryKey(),
    taskId: uuid()
      .notNull()
      .references(() => facilityTasks.id, { onDelete: "restrict" }),
    submittedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    acceptedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    acceptedAt: timestamp({ withTimezone: true }),
    content: text().notNull(),
    submittedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("facility_task_reports_history_idx").on(t.taskId, t.submittedAt, t.id),
    uniqueIndex("facility_task_reports_one_accepted_per_task_idx")
      .on(t.taskId)
      .where(sql`${t.acceptedAt} IS NOT NULL`),
    check(
      "facility_task_reports_acceptance_valid",
      sql`(${t.acceptedBy} IS NULL AND ${t.acceptedAt} IS NULL) OR (${t.acceptedBy} IS NOT NULL AND ${t.acceptedAt} IS NOT NULL)`,
    ),
    check(
      "facility_task_reports_content_valid",
      sql`length(btrim(${t.content})) BETWEEN 1 AND 5000`,
    ),
  ],
);
export type FacilityTaskReport = typeof facilityTaskReports.$inferSelect;
