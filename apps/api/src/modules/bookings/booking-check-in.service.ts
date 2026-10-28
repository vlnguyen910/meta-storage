import type {
  CheckInBookingSummary,
  CheckInLookupInput,
  CheckInLookupResult,
  CheckInPaymentSummary,
  PhysicalUnitAssignment,
} from "@metastorage/contracts";
import { NotFoundError } from "../../common/errors/app-error";
import {
  type CheckInPolicyEvaluation,
  evaluateCheckInEligibility,
} from "./booking-check-in.policy";
import type { BookingCheckInRepository, CheckInRecord } from "./booking-check-in.repository";
import { closeBookingBeforeCheckIn } from "./bookings.repository";

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
  };
}

export class BookingCheckInService {
  constructor(
    private readonly repository: BookingCheckInRepository,
    private readonly clock: () => Date = () => new Date(),
    private readonly allowEarlyCheckIn = false,
  ) {}

  async getFacilityIdForLookup(input: CheckInLookupInput): Promise<string> {
    const facilityId = await this.repository.findFacilityIdByLookup(input.type, input.value);
    if (!facilityId) throw new NotFoundError("QR hoặc Booking ID không hợp lệ");
    return facilityId;
  }

  async getAssignedStaffForLookup(input: CheckInLookupInput): Promise<string | null> {
    const record = await this.repository.findByLookup(input.type, input.value);
    return record?.booking.assignedStaffId ?? null;
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
      },
      now,
      this.allowEarlyCheckIn,
    );

    if (evaluation.shouldMarkNoShow) {
      const bookingId = record.booking.id;
      await this.repository.transaction((tx) =>
        closeBookingBeforeCheckIn(tx, bookingId, "NO_SHOW", now),
      );
      record = await this.repository.findByBookingId(bookingId);
      if (!record) throw new NotFoundError("Không tìm thấy booking");
      evaluation = evaluateCheckInEligibility(
        {
          bookingStatus: record.booking.status,
          payment: record.payment,
          hasAssignedUnit: Boolean(record.assignment && record.assignedUnit),
          checkInSlotStart: record.booking.checkInSlotStart,
          checkInDayEnd: record.checkInDayEnd,
        },
        this.clock(),
        this.allowEarlyCheckIn,
      );
    }

    return toResult(record, evaluation);
  }
}
