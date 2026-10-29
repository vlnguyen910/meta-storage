import type { CheckInReadiness, CheckInReadinessReasonCode } from "@metastorage/contracts";

export type CheckInPolicyRecord = {
  bookingStatus: string;
  payment: { status: string } | null;
  hasAssignedUnit: boolean;
  checkInOpensAt: Date;
  checkInSlotStart: Date;
  checkInDeadline: Date | null;
};

export type CheckInPolicyEvaluation = CheckInReadiness & {
  checkInDeadlineAt: Date | null;
  shouldMarkNoShow: boolean;
};

export function getCheckInDeadlineAt(checkInDate: string, closingHour: number): Date {
  const midnight = new Date(`${checkInDate}T00:00:00+07:00`);
  return closingHour === 24
    ? new Date(midnight.getTime() + 24 * 60 * 60 * 1000)
    : new Date(`${checkInDate}T${String(closingHour).padStart(2, "0")}:00:00+07:00`);
}

export function getCheckInOpensAt(checkInDate: string, openingHour: number): Date {
  return new Date(`${checkInDate}T${String(openingHour).padStart(2, "0")}:00:00+07:00`);
}

export function evaluateCheckInReadiness(
  record: CheckInPolicyRecord,
  now: Date,
  skipTimeWindow = false,
): CheckInPolicyEvaluation {
  const reasons: CheckInReadinessReasonCode[] = [];
  const checkInDeadline = record.checkInDeadline;

  if (record.bookingStatus !== "CONFIRMED") {
    reasons.push("INVALID_BOOKING_STATUS");
  }

  if (record.payment?.status !== "SUCCEEDED") {
    reasons.push("PAYMENT_NOT_SUCCEEDED");
  }

  if (!record.hasAssignedUnit) {
    reasons.push("UNIT_NOT_ASSIGNED");
  }

  if (
    !checkInDeadline ||
    !Number.isFinite(record.checkInOpensAt.getTime()) ||
    !Number.isFinite(record.checkInSlotStart.getTime())
  ) {
    reasons.push("CHECKIN_SLOT_NOT_CONFIGURED");
  } else if (!skipTimeWindow && now < record.checkInOpensAt) {
    reasons.push("TOO_EARLY");
  } else if (!skipTimeWindow && now >= checkInDeadline) {
    reasons.push("DEADLINE_PASSED");
  }

  return {
    canProceed: reasons.length === 0,
    reasons,
    checkInDeadlineAt: checkInDeadline,
    shouldMarkNoShow:
      !skipTimeWindow &&
      record.bookingStatus === "CONFIRMED" &&
      reasons.includes("DEADLINE_PASSED"),
  };
}
