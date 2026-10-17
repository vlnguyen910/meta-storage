import {
  type BookingListItem,
  type CheckInLookupResult,
  PaymentStatus,
  UserRole,
} from "@metastorage/contracts";
import type { MockDatabase, MockUser } from "../types";
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
export function lookupResult(db: MockDatabase, booking: BookingListItem): CheckInLookupResult {
  const graceEndsAt = booking.checkInSlotEnd
    ? new Date(Date.parse(booking.checkInSlotEnd) + 7200000).toISOString()
    : null;
  const reasons: CheckInLookupResult["eligibility"]["reasons"] = [];
  if (booking.status !== "CONFIRMED") reasons.push("INVALID_BOOKING_STATUS");
  if (!booking.assignedUnit) reasons.push("UNIT_NOT_ASSIGNED");
  if (!graceEndsAt) reasons.push("CHECKIN_SLOT_NOT_CONFIGURED");
  else if (Date.now() < Date.parse(booking.checkInSlotStart)) reasons.push("TOO_EARLY");
  else if (Date.now() > Date.parse(graceEndsAt)) reasons.push("DEADLINE_PASSED");
  const rate = booking.totalAmount / (booking.requestedMonths + 1);
  return {
    booking: { ...booking, graceEndsAt },
    payment: {
      status: booking.paidAt ? PaymentStatus.SUCCEEDED : null,
      paidAt: booking.paidAt,
      totalAmount: booking.totalAmount,
      rentalFeeAmount: rate * booking.requestedMonths,
      depositAmount: rate,
      currency: "VND",
    },
    assignedUnit: booking.assignedUnit ?? null,
    eligibility: {
      canProceed: reasons.length === 0 && Boolean(booking.paidAt && booking.assignedStaff),
      reasons,
    },
    verification:
      db.verifications.find(
        (v) =>
          v.bookingId === booking.id &&
          v.status !== "INVALIDATED" &&
          v.unitAssignmentId === booking.assignedUnit?.id,
      ) ?? null,
  };
}
export function invalidateVerification(db: MockDatabase, booking: BookingListItem): void {
  for (const v of db.verifications.filter(
    (v) => v.bookingId === booking.id && v.status === "VERIFIED",
  )) {
    v.status = "INVALIDATED";
    v.invalidatedAt = new Date().toISOString();
    v.invalidatedReason = "ASSIGNMENT_CHANGED";
  }
}
