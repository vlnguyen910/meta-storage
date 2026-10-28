import {
  HANDOVER_CHECKLIST_ITEMS,
  HandoverChecklistCompletionSchema,
  type MobilePaidBooking,
} from "@metastorage/contracts";
import { DEMO_MESSAGES as m } from "./demo.messages";
import type { DemoDatabase } from "./demo.types";
import { addMonths } from "./demo-seed";

export function requirePeriod(checkInAt: string, months: number, now = Date.now()) {
  const time = Date.parse(checkInAt);
  if (
    !Number.isFinite(time) ||
    time <= now ||
    time > now + 30 * 86400000 ||
    !Number.isInteger(months) ||
    months < 1 ||
    months > 12
  )
    throw new Error(m.period);
}
export function remainingDemoCapacity(
  db: DemoDatabase,
  facilityId: string,
  unitTypeId: string,
  start: string,
  end: string,
  excludeId?: string,
): number {
  const type = db.unitTypes.find((t) => t.facilityId === facilityId && t.unitTypeId === unitTypeId);
  if (!type) return 0;
  const overlaps = (s: string, e: string) =>
    Date.parse(s) < Date.parse(end) && Date.parse(e) > Date.parse(start);
  const bookings = db.bookings.filter(
    (b) =>
      b.id !== excludeId &&
      b.facilityId === facilityId &&
      b.unitTypeId === unitTypeId &&
      ["CONFIRMED", "CHECKED_IN"].includes(b.status) &&
      overlaps(b.checkInSlotStart, b.rentalEndAt),
  ).length;
  const holds = db.drafts.filter(
    (d) =>
      d.id !== excludeId &&
      d.facilityId === facilityId &&
      d.unitTypeId === unitTypeId &&
      d.hold &&
      Date.parse(d.hold.expiresAt) > Date.now() &&
      overlaps(d.checkInAt, d.rentalEndAt),
  ).length;
  return Math.max(0, type.availableCount - bookings - holds);
}
export function canVerifyBooking(booking: MobilePaidBooking, now = Date.now()) {
  return (
    booking.status === "CONFIRMED" &&
    !!booking.paidAt &&
    !!booking.assignedUnit &&
    !!booking.assignedStaff &&
    now >= Date.parse(booking.checkInSlotStart) &&
    now <= Date.parse(booking.checkInSlotEnd ?? booking.checkInSlotStart) + 7200000
  );
}
export function validateReschedule(db: DemoDatabase, booking: MobilePaidBooking, start: string) {
  if (
    booking.status !== "CONFIRMED" ||
    db.inspections.some((inspection) => inspection.bookingId === booking.id) ||
    Date.parse(booking.checkInSlotStart) - Date.now() < 86400000 ||
    booking.rescheduleCount >= 2
  )
    throw new Error(m.reschedule);
  requirePeriod(start, booking.requestedMonths);
  if (
    !remainingDemoCapacity(
      db,
      booking.facilityId,
      booking.unitTypeId,
      start,
      addMonths(start, booking.requestedMonths),
      booking.id,
    )
  )
    throw new Error(m.capacity);
}
export function requireCompleteChecklist(checklist: unknown) {
  const parsed = HandoverChecklistCompletionSchema.safeParse(checklist);
  if (!parsed.success) throw new Error(m.inspection);
}
export function requireReturnChecklist(checklist: { itemCode: string; resultType: string }[]) {
  if (
    checklist.length !== HANDOVER_CHECKLIST_ITEMS.length ||
    checklist.some((item) => item.resultType !== "PASS_FAIL") ||
    !HANDOVER_CHECKLIST_ITEMS.every(
      (item) => checklist.filter((entry) => entry.itemCode === item.code).length === 1,
    )
  )
    throw new Error(m.invalid);
}
