import type { CheckInSlotOption } from "@metastorage/contracts";

export function canSelectCheckInSlot(date: string, startTime: string, now = new Date()) {
  return Boolean(date) && new Date(`${date}T${startTime}+07:00`).getTime() > now.getTime();
}

export function firstCheckInDate(slots: CheckInSlotOption[], now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  if (!slots.length || slots.some((slot) => canSelectCheckInSlot(today, slot.startTime, now)))
    return today;
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}
