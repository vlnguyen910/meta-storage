import type { CheckInEligibility, CheckInEligibilityReasonCode } from "@metastorage/contracts";
import type { CheckInVerification } from "@metastorage/database";

export type CheckInPolicyRecord = {
  bookingStatus: string;
  payment: { status: string } | null;
  hasAssignedUnit: boolean;
  checkInSlotStart: Date;
  checkInDayEnd: Date | null;
  verification: CheckInVerification | null;
};

export type CheckInPolicyEvaluation = CheckInEligibility & {
  graceEndsAt: Date | null;
  shouldMarkNoShow: boolean;
};

export function evaluateCheckInEligibility(
  record: CheckInPolicyRecord,
  now: Date,
): CheckInPolicyEvaluation {
  const reasons: CheckInEligibilityReasonCode[] = [];
  const graceEndsAt = record.checkInDayEnd;

  if (record.bookingStatus !== "CONFIRMED") {
    reasons.push("INVALID_BOOKING_STATUS");
  }

  if (record.payment?.status !== "SUCCEEDED") {
    reasons.push("PAYMENT_NOT_SUCCEEDED");
  }

  if (!record.hasAssignedUnit) {
    reasons.push("UNIT_NOT_ASSIGNED");
  }

  if (!graceEndsAt) {
    reasons.push("CHECKIN_SLOT_NOT_CONFIGURED");
  } else if (now < record.checkInSlotStart) {
    reasons.push("TOO_EARLY");
  } else if (now >= graceEndsAt) {
    reasons.push("DEADLINE_PASSED");
  }

  return {
    canProceed: reasons.length === 0,
    reasons,
    graceEndsAt,
    shouldMarkNoShow: record.bookingStatus === "CONFIRMED" && reasons.includes("DEADLINE_PASSED"),
  };
}
