import type { MockDatabase } from "../types";

export function remainingCapacity(
  database: MockDatabase,
  facilityId: string,
  unitTypeId: string,
  startsAt: string,
  endsAt: string,
  excludedDraftId?: string,
): number {
  const overlaps = (start: string, end: string) =>
    Date.parse(start) < Date.parse(endsAt) && Date.parse(end) > Date.parse(startsAt);
  const free = database.units.filter(
    (unit) =>
      unit.facilityId === facilityId &&
      unit.unitTypeId === unitTypeId &&
      unit.status === "AVAILABLE",
  ).length;
  const held = database.holds.filter(
    (hold) =>
      hold.unitTypeId === unitTypeId &&
      hold.draftId !== excludedDraftId &&
      Date.parse(hold.expiresAt) > Date.now() &&
      overlaps(hold.startsAt, hold.endsAt),
  ).length;
  // Assigned bookings already consume a RESERVED physical unit above.
  const booked = database.bookings.filter(
    (booking) =>
      booking.facilityId === facilityId &&
      booking.unitTypeId === unitTypeId &&
      booking.status === "CONFIRMED" &&
      !booking.assignedUnit &&
      overlaps(booking.checkInSlotStart, booking.rentalEndAt),
  ).length;
  return Math.max(0, free - held - booked);
}
