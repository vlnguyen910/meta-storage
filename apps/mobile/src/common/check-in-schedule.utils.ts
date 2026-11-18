import type { CheckInSlotOption } from "@metastorage/contracts";

export function canSelectCheckInSlot(date: string, slot: CheckInSlotOption, now = new Date()) {
  if (!date) return false;
  const isToday = date === localDate(now);
  if (isToday && slot.sameDayCheckInEnabled) return true;
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
