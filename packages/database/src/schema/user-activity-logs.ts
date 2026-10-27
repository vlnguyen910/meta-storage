import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { facilities } from "./facilities";
import { users } from "./users";

export const userActivityLogs = pgTable(
  "user_activity_logs",
  {
    id: uuid().defaultRandom().primaryKey(),
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    action: varchar({ length: 120 }).notNull(),
    entityType: varchar({ length: 80 }).notNull(),
    entityId: varchar({ length: 255 }),
    facilityId: uuid().references(() => facilities.id, { onDelete: "set null" }),
    occurredAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("user_activity_logs_time_idx").on(table.occurredAt, table.id),
    index("user_activity_logs_actor_time_idx").on(table.actorId, table.occurredAt, table.id),
    index("user_activity_logs_entity_idx").on(
      table.entityType,
      table.entityId,
      table.occurredAt,
      table.id,
    ),
    index("user_activity_logs_facility_time_idx").on(table.facilityId, table.occurredAt, table.id),
  ],
);
