import { pgTable, text, time, uuid } from "drizzle-orm/pg-core";

export const checkInSlots = pgTable("check_in_slots", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
});

export type CheckInSlot = typeof checkInSlots.$inferSelect;
export type NewCheckInSlot = typeof checkInSlots.$inferInsert;
