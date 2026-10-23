import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { storageUnitStatusEnum, storageUnits } from "./storage-units";
import { users } from "./users";

export const storageUnitMaintenanceActionEnum = pgEnum("storage_unit_maintenance_action", [
  "ENTER_MAINTENANCE",
  "EXIT_MAINTENANCE",
]);
export const storageUnitMaintenanceHistory = pgTable(
  "storage_unit_maintenance_history",
  {
    id: uuid().defaultRandom().primaryKey(),
    storageUnitId: uuid()
      .notNull()
      .references(() => storageUnits.id, { onDelete: "restrict" }),
    action: storageUnitMaintenanceActionEnum().notNull(),
    previousStatus: storageUnitStatusEnum().notNull(),
    nextStatus: storageUnitStatusEnum().notNull(),
    reason: text(),
    changedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    changedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("storage_unit_maintenance_history_unit_idx").on(t.storageUnitId, t.changedAt, t.id),
  ],
);

export type StorageUnitMaintenanceHistory = typeof storageUnitMaintenanceHistory.$inferSelect;
