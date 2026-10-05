const CHECK_IN_SLOT_DURATION_MS = 2 * 60 * 60 * 1000;

export function getCheckInSlotEnd(start: Date): Date {
  return new Date(start.getTime() + CHECK_IN_SLOT_DURATION_MS);
}
