import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { enumToPgEnum } from "../enum-to-pg-enum";
import { checkInSlots } from "./check-in-slots";
import { facilities } from "./facilities";
import { rentals } from "./rentals";
import { reservations } from "./reservations";
import { supportTickets } from "./support";
import { users } from "./users";

export enum APPOINTMENT_TYPES {
  CHECK_IN = "CHECK_IN",
  CHECK_OUT = "CHECK_OUT",
  SUPPORT = "SUPPORT",
}

export enum APPOINTMENT_STATUSES {
  SCHEDULED = "SCHEDULED",
  CONFIRMED = "CONFIRMED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
}

export const appointmentTypeEnum = pgEnum("appointment_type", enumToPgEnum(APPOINTMENT_TYPES));
export const appointmentStatusEnum = pgEnum(
  "appointment_status",
  enumToPgEnum(APPOINTMENT_STATUSES),
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid().defaultRandom().primaryKey(),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    appointmentType: appointmentTypeEnum().notNull(),
    scheduledDate: date({ mode: "string" }).notNull(),
    slotId: uuid()
      .notNull()
      .references(() => checkInSlots.id, { onDelete: "restrict" }),
    status: appointmentStatusEnum().default(APPOINTMENT_STATUSES.SCHEDULED).notNull(),
    customerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    contactPhone: varchar({ length: 20 }),
    reservationId: uuid().references(() => reservations.id, { onDelete: "restrict" }),
    rentalId: uuid().references(() => rentals.id, { onDelete: "restrict" }),
    supportTicketId: uuid().references(() => supportTickets.id, { onDelete: "restrict" }),
    assignedStaffId: uuid().references(() => users.id, { onDelete: "restrict" }),
    createdBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    notes: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "appointments_context_valid",
      sql`(${table.appointmentType} = 'CHECK_IN' AND ${table.reservationId} IS NOT NULL AND ${table.rentalId} IS NULL AND ${table.supportTicketId} IS NULL) OR (${table.appointmentType} = 'CHECK_OUT' AND ${table.reservationId} IS NULL AND ${table.rentalId} IS NOT NULL AND ${table.supportTicketId} IS NULL) OR (${table.appointmentType} = 'SUPPORT' AND ${table.reservationId} IS NULL AND ${table.rentalId} IS NULL)`,
    ),
    index("appointments_facility_schedule_idx").on(
      table.facilityId,
      table.scheduledDate,
      table.appointmentType,
      table.status,
    ),
    index("appointments_staff_schedule_idx").on(
      table.assignedStaffId,
      table.scheduledDate,
      table.status,
    ),
    index("appointments_customer_idx").on(table.customerId, table.scheduledDate),
    uniqueIndex("appointments_check_in_reservation_idx")
      .on(table.reservationId)
      .where(sql`${table.appointmentType} = 'CHECK_IN'`),
    uniqueIndex("appointments_check_out_slot_idx")
      .on(table.facilityId, table.scheduledDate, table.slotId)
      .where(sql`${table.appointmentType} = 'CHECK_OUT' AND ${table.status} = 'CONFIRMED'`),
  ],
);

export type AppointmentRecord = typeof appointments.$inferSelect;
export type NewAppointmentRecord = typeof appointments.$inferInsert;
