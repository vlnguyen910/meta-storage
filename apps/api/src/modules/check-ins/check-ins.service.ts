import type {
  CheckInBookingSummary,
  CheckInConfirmResult,
  CheckInLookupInput,
  CheckInLookupResult,
  CheckInPaymentSummary,
  CheckInVerification,
  PhysicalUnitAssignment,
} from "@metastorage/contracts";
import type { CheckInVerification as DbCheckInVerification } from "@metastorage/database";
import { ConflictError, NotFoundError } from "../../common/errors/app-error";
import { type CheckInPolicyEvaluation, evaluateCheckInEligibility } from "./check-ins.policy";
import type { CheckInRecord, CheckInsRepository } from "./check-ins.repository";

function toAssignedUnit(record: CheckInRecord): PhysicalUnitAssignment | null {
  if (!record.assignment || !record.assignedUnit) return null;
  return {
    id: record.assignment.id,
    bookingId: record.assignment.bookingId,
    physicalUnitId: record.assignment.physicalUnitId,
    physicalUnitCode: record.assignedUnit.code,
    assignedBy: record.assignment.assignedBy,
    status: record.assignment.status as PhysicalUnitAssignment["status"],
    assignedAt: record.assignment.assignedAt.toISOString(),
    endedAt: record.assignment.endedAt?.toISOString() ?? null,
    reason: record.assignment.reason ?? null,
  };
}

function toPayment(record: CheckInRecord): CheckInPaymentSummary {
  return {
    status: (record.payment?.status as CheckInPaymentSummary["status"]) ?? null,
    paidAt: record.payment?.paidAt?.toISOString() ?? null,
    totalAmount: record.payment ? Number(record.payment.totalAmount) : null,
    rentalFeeAmount: record.payment ? Number(record.booking.rentalFeeAmount) : null,
    depositAmount: record.payment ? Number(record.booking.depositAmount) : null,
    currency: record.payment?.currency ?? null,
  };
}

function toVerification(verification: DbCheckInVerification | null): CheckInVerification | null {
  if (!verification) return null;
  return {
    id: verification.id,
    bookingId: verification.bookingId,
    facilityId: verification.facilityId,
    staffId: verification.staffId,
    unitAssignmentId: verification.unitAssignmentId,
    status: verification.status,
    verifiedAt: verification.verifiedAt.toISOString(),
    consumedAt: verification.consumedAt?.toISOString() ?? null,
    invalidatedAt: verification.invalidatedAt?.toISOString() ?? null,
    invalidatedReason: verification.invalidatedReason ?? null,
  };
}

function toResult(record: CheckInRecord, evaluation: CheckInPolicyEvaluation): CheckInLookupResult {
  const booking: CheckInBookingSummary = {
    id: record.booking.id,
    bookingCode: record.booking.bookingCode ?? record.booking.id.slice(0, 8).toUpperCase(),
    status: record.booking.status as CheckInBookingSummary["status"],
    facilityId: record.booking.facilityId,
    facilityName: record.facility.name,
    unitTypeName: record.unitType.name,
    unitTypeSizeLabel: record.unitType.sizeLabel,
    contactName: record.booking.contactName,
    contactEmail: record.booking.contactEmail,
    contactPhone: record.booking.contactPhone,
    totalAmount: Number(record.booking.totalAmount),
    requestedMonths: record.booking.requestedMonths,
    checkInSlotStart: record.booking.checkInSlotStart.toISOString(),
    checkInSlotEnd: record.booking.checkInSlotEnd?.toISOString() ?? null,
    graceEndsAt: evaluation.graceEndsAt?.toISOString() ?? null,
    rentalEndAt: record.booking.rentalEndAt.toISOString(),
  };

  return {
    booking,
    payment: toPayment(record),
    assignedUnit: toAssignedUnit(record),
    eligibility: {
      canProceed: evaluation.canProceed,
      reasons: evaluation.reasons,
    },
    verification: toVerification(record.verification),
  };
}

export class CheckInsService {
  constructor(
    private readonly repository: CheckInsRepository,
    private readonly clock: () => Date = () => new Date(),
    private readonly allowEarlyCheckIn = false,
  ) {}

  async getFacilityIdForLookup(input: CheckInLookupInput): Promise<string> {
    const facilityId = await this.repository.findFacilityIdByLookup(input.type, input.value);
    if (!facilityId) throw new NotFoundError("QR hoặc Booking ID không hợp lệ");
    return facilityId;
  }

  async getFacilityIdForBooking(bookingId: string): Promise<string> {
    const facilityId = await this.repository.findFacilityIdByBookingId(bookingId);
    if (!facilityId) throw new NotFoundError("Không tìm thấy booking");
    return facilityId;
  }

  async lookup(input: CheckInLookupInput): Promise<CheckInLookupResult> {
    let record = await this.repository.findByLookup(input.type, input.value);
    if (!record) throw new NotFoundError("QR hoặc Booking ID không hợp lệ");

    const now = this.clock();
    let evaluation = evaluateCheckInEligibility(
      {
        bookingStatus: record.booking.status,
        payment: record.payment,
        hasAssignedUnit: Boolean(record.assignment && record.assignedUnit),
        checkInSlotStart: record.booking.checkInSlotStart,
        checkInDayEnd: record.checkInDayEnd,
        verification: record.verification,
      },
      now,
      this.allowEarlyCheckIn,
    );

    if (evaluation.shouldMarkNoShow) {
      await this.repository.confirmVerification(
        record.booking.id,
        "system-check-in-expiry",
        now,
        (candidate, now) =>
          evaluateCheckInEligibility(
            {
              bookingStatus: candidate.booking.status,
              payment: candidate.payment,
              hasAssignedUnit: Boolean(candidate.assignment && candidate.assignedUnit),
              checkInSlotStart: candidate.booking.checkInSlotStart,
              checkInDayEnd: candidate.checkInDayEnd,
              verification: candidate.verification,
            },
            now,
            this.allowEarlyCheckIn,
          ),
      );
      record = await this.repository.findByBookingId(record.booking.id);
      if (!record) throw new NotFoundError("Không tìm thấy booking");
      evaluation = evaluateCheckInEligibility(
        {
          bookingStatus: record.booking.status,
          payment: record.payment,
          hasAssignedUnit: Boolean(record.assignment && record.assignedUnit),
          checkInSlotStart: record.booking.checkInSlotStart,
          checkInDayEnd: record.checkInDayEnd,
          verification: record.verification,
        },
        this.clock(),
        this.allowEarlyCheckIn,
      );
    }

    return toResult(record, evaluation);
  }

  async confirm(bookingId: string, staffId: string): Promise<CheckInConfirmResult> {
    const now = this.clock();
    const result = await this.repository.confirmVerification(
      bookingId,
      staffId,
      now,
      (record, now) =>
        evaluateCheckInEligibility(
          {
            bookingStatus: record.booking.status,
            payment: record.payment,
            hasAssignedUnit: Boolean(record.assignment && record.assignedUnit),
            checkInSlotStart: record.booking.checkInSlotStart,
            checkInDayEnd: record.checkInDayEnd,
            verification: record.verification,
          },
          now,
          this.allowEarlyCheckIn,
        ),
    );
    if (!result) throw new NotFoundError("Không tìm thấy booking");

    const evaluation = evaluateCheckInEligibility(
      {
        bookingStatus: result.record.booking.status,
        payment: result.record.payment,
        hasAssignedUnit: Boolean(result.record.assignment && result.record.assignedUnit),
        checkInSlotStart: result.record.booking.checkInSlotStart,
        checkInDayEnd: result.record.checkInDayEnd,
        verification: result.record.verification,
      },
      now,
      this.allowEarlyCheckIn,
    );
    const response = toResult(result.record, evaluation);

    if (result.kind === "INELIGIBLE" || result.kind === "NO_SHOW") {
      throw new ConflictError(
        result.kind === "NO_SHOW"
          ? "Booking đã chuyển NO_SHOW vì quá grace period"
          : "Booking chưa đủ điều kiện để tiếp tục check-in",
      );
    }

    return response;
  }
}
