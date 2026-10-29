import {
  type BookingListItem,
  type CheckInLookupResult,
  PaymentStatus,
  SYSTEM_SETTING_DEFINITIONS,
} from "@metastorage/contracts";
import { UserRole } from "@metastorage/database/schema/user-enums";
import type { MockUser } from "../types";
export function canReadBooking(user: MockUser | null, booking: BookingListItem): boolean {
  return Boolean(
    user?.assignedFacilityIds.includes(booking.facilityId) &&
      (user.role === UserRole.FACILITY_MANAGER ||
        (user.role === UserRole.FACILITY_STAFF && booking.assignedStaff?.id === user.id)),
  );
}
export function canManageBooking(user: MockUser | null, booking: BookingListItem): boolean {
  return Boolean(
    user?.role === UserRole.FACILITY_MANAGER &&
      user.assignedFacilityIds.includes(booking.facilityId),
  );
}
export function lookupResult(booking: BookingListItem): CheckInLookupResult {
  const localDate = booking.checkInSlotStart
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
        new Date(booking.checkInSlotStart),
      )
    : null;
  const checkInDeadlineAt = localDate
    ? new Date(
        `${localDate}T${String(SYSTEM_SETTING_DEFINITIONS.CLOSING_HOUR.defaultValue).padStart(2, "0")}:00:00+07:00`,
      ).toISOString()
    : null;
  const checkInOpensAt = localDate
    ? new Date(
        `${localDate}T${String(SYSTEM_SETTING_DEFINITIONS.OPENING_HOUR.defaultValue).padStart(2, "0")}:00:00+07:00`,
      ).getTime()
    : null;
  const reasons: CheckInLookupResult["checkInReadiness"]["reasons"] = [];
  if (booking.status !== "CONFIRMED") reasons.push("INVALID_BOOKING_STATUS");
  if (!booking.paidAt) reasons.push("PAYMENT_NOT_SUCCEEDED");
  if (!booking.assignedUnit) reasons.push("UNIT_NOT_ASSIGNED");
  if (!checkInDeadlineAt) reasons.push("CHECKIN_SLOT_NOT_CONFIGURED");
  else if (checkInOpensAt !== null && Date.now() < checkInOpensAt) reasons.push("TOO_EARLY");
  else if (Date.now() >= Date.parse(checkInDeadlineAt)) reasons.push("DEADLINE_PASSED");
  const rate = booking.totalAmount / (booking.requestedMonths + 1);
  return {
    booking: { ...booking, checkInDeadlineAt },
    payment: {
      status: booking.paidAt ? PaymentStatus.SUCCEEDED : null,
      paidAt: booking.paidAt,
      totalAmount: booking.totalAmount,
      rentalFeeAmount: rate * booking.requestedMonths,
      depositAmount: rate,
      currency: "VND",
    },
    assignedUnit: booking.assignedUnit ?? null,
    checkInReadiness: {
      canProceed: reasons.length === 0 && Boolean(booking.paidAt && booking.assignedStaff),
      reasons,
    },
  };
}
