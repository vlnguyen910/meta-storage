import {
  type AppointmentRecordDto,
  APPOINTMENT_STATUSES as Status,
  APPOINTMENT_TYPES as Type,
} from "@metastorage/contracts";
import { CUSTOMER_HOME as M } from "../features/customer-home/customer-home.messages";
import type { AppointmentFilter } from "./customer-home.types";

export const vietnamDate = (now = Date.now()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
export const formatAppointmentDate = (date: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00+07:00`));
export const shiftDate = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export const weekStart = (date: string) =>
  shiftDate(date, -new Date(`${date}T00:00:00Z`).getUTCDay());
export const isOpenAppointment = (a: AppointmentRecordDto) =>
  a.status === Status.SCHEDULED || a.status === Status.CONFIRMED;
export const appointmentStart = (a: AppointmentRecordDto) =>
  Date.parse(`${a.scheduledDate}T${a.slotStart || "00:00:00"}+07:00`);
export const appointmentEnd = (a: AppointmentRecordDto) =>
  Date.parse(`${a.scheduledDate}T${a.slotEnd || "23:59:59"}+07:00`);
export const appointmentTime = (a: AppointmentRecordDto) =>
  a.slotStart
    ? `${a.slotStart.slice(0, 5)}${a.slotEnd ? ` – ${a.slotEnd.slice(0, 5)}` : ""}`
    : M.timeUnknown;
export const paymentLabel = (status?: string | null) =>
  M.payments[status as keyof typeof M.payments] ?? M.empty;
export function appointmentTiming(a: AppointmentRecordDto, now: number) {
  if (!isOpenAppointment(a)) return M.statuses[a.status];
  const start = appointmentStart(a);
  if (appointmentEnd(a) < now) return M.passed;
  if (start <= now) return M.inSlot;
  return start - now < 86400000 && a.slotStart
    ? M.minutes(Math.ceil((start - now) / 60000))
    : M.later;
}
export function nextCheckIn(items: AppointmentRecordDto[], now: number) {
  return items
    .filter(
      (a) =>
        a.appointmentType === Type.CHECK_IN && isOpenAppointment(a) && appointmentEnd(a) >= now,
    )
    .sort((a, b) => appointmentStart(a) - appointmentStart(b))[0];
}
export function matchesAppointmentFilter(
  a: AppointmentRecordDto,
  filter: AppointmentFilter,
  now: number,
) {
  return (
    filter === "all" ||
    (filter === "upcoming" && isOpenAppointment(a) && appointmentEnd(a) >= now) ||
    (filter === "completed" && a.status === Status.COMPLETED) ||
    (filter === "closed" && [Status.CANCELLED, Status.NO_SHOW].includes(a.status))
  );
}
