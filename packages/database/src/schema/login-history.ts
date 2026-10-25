import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

export const loginHistory = pgTable(
  "login_history",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    sessionId: varchar({ length: 255 }).notNull().unique(),
    occurredAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    device: varchar({ length: 120 }),
    operatingSystem: varchar({ length: 120 }),
    browser: varchar({ length: 120 }),
    model: varchar({ length: 120 }),
  },
  (table) => [
    index("login_history_time_idx").on(table.occurredAt, table.id),
    index("login_history_user_time_idx").on(table.userId, table.occurredAt, table.id),
  ],
);
