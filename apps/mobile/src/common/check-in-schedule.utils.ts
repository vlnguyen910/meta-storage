import type { CheckInSlotOption } from "@metastorage/contracts";

export function canSelectCheckInSlot(date: string, slot: CheckInSlotOption, now = new Date()) {
  if (!date) return false;
  const isToday = date === localDate(now);
  if (isToday && !slot.sameDayCheckInEnabled) return false;
  const cutoff = isToday ? slot.endTime : slot.startTime;
  const slotTime = new Date(`${date}T${cutoff}+07:00`).getTime();
  return slotTime > now.getTime();
}

function localDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function firstCheckInDate(slots: CheckInSlotOption[], now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  if (!slots.length || slots.some((slot) => canSelectCheckInSlot(today, slot, now))) return today;
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}
