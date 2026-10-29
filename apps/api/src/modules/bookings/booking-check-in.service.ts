import type {
  CheckInBookingSummary,
  CheckInLookupInput,
  CheckInLookupResult,
  CheckInPaymentSummary,
  PhysicalUnitAssignment,
} from "@metastorage/contracts";
import type { Database } from "@metastorage/database";
import { ConflictError, NotFoundError } from "../../common/errors/app-error";
import { env } from "../../config/env";
import { SystemSettingsRepository } from "../system-settings/system-settings.repository";
import { SystemSettingsService } from "../system-settings/system-settings.service";
import {
  type CheckInPolicyEvaluation,
  evaluateCheckInReadiness,
  getCheckInDeadlineAt,
  getCheckInOpensAt,
} from "./booking-check-in.policy";
import { BookingCheckInRepository, type CheckInRecord } from "./booking-check-in.repository";
import { BOOKING_MESSAGES } from "./bookings.messages";
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
    checkInDeadlineAt: evaluation.checkInDeadlineAt?.toISOString() ?? null,
    rentalEndAt: record.booking.rentalEndAt.toISOString(),
  };

  return {
    booking,
    payment: toPayment(record),
    assignedUnit: toAssignedUnit(record),
    checkInReadiness: {
      canProceed: evaluation.canProceed,
      reasons: evaluation.reasons,
    },
  };
}

export class BookingCheckInService {
  constructor(
    private readonly repository: BookingCheckInRepository,
    private readonly settings: Pick<SystemSettingsService, "getOpeningHour" | "getClosingHour">,
    private readonly clock: () => Date = () => new Date(),
    private readonly skipTimeWindow = env.NODE_ENV === "develop" || env.NODE_ENV === "development",
  ) {}

  async assertCheckInCanStart(bookingId: string): Promise<void> {
    const record = await this.repository.findByBookingId(bookingId);
    if (!record) throw new NotFoundError(BOOKING_MESSAGES.bookingNotFound);
    const { evaluation } = await this.resolveReadiness(record, true);
    if (!evaluation.canProceed) {
      const details = evaluation.reasons.map((reason) => ({
        field: `checkInReadiness.${reason}`,
        message: BOOKING_MESSAGES.checkInReadinessReasons[reason],
      }));
      throw new ConflictError(
        BOOKING_MESSAGES.checkInNotReady(details.map(({ message }) => message)),
        details,
      );
    }
  }

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
    const record = await this.repository.findByLookup(input.type, input.value);
    if (!record) throw new NotFoundError("QR hoặc Booking ID không hợp lệ");
    const resolved = await this.resolveReadiness(record);
    return toResult(resolved.record, resolved.evaluation);
  }

  private async resolveReadiness(record: CheckInRecord, markNoShow = false) {
    const now = this.clock();
    const [openingHour, closingHour] = await Promise.all([
      this.settings.getOpeningHour(),
      this.settings.getClosingHour(),
    ]);
    const checkInOpensAt = getCheckInOpensAt(record.booking.checkInDate, openingHour);
    const checkInDeadline = getCheckInDeadlineAt(record.booking.checkInDate, closingHour);
    let evaluation = evaluateCheckInReadiness(
      {
        bookingStatus: record.booking.status,
        payment: record.payment,
        hasAssignedUnit: Boolean(record.assignment && record.assignedUnit),
        checkInOpensAt,
        checkInSlotStart: record.booking.checkInSlotStart,
        checkInDeadline,
      },
      now,
      this.skipTimeWindow,
    );

    if (markNoShow && evaluation.shouldMarkNoShow) {
      const bookingId = record.booking.id;
      await this.repository.transaction((tx) =>
        closeBookingBeforeCheckIn(tx, bookingId, "NO_SHOW", now),
      );
      const refreshedRecord = await this.repository.findByBookingId(bookingId);
      if (!refreshedRecord) throw new NotFoundError(BOOKING_MESSAGES.bookingNotFound);
      record = refreshedRecord;
      evaluation = evaluateCheckInReadiness(
        {
          bookingStatus: record.booking.status,
          payment: record.payment,
          hasAssignedUnit: Boolean(record.assignment && record.assignedUnit),
          checkInOpensAt,
          checkInSlotStart: record.booking.checkInSlotStart,
          checkInDeadline,
        },
        this.clock(),
        this.skipTimeWindow,
      );
    }
    return { record, evaluation };
  }
}

export function createBookingCheckInService(db: Database, clock: () => Date = () => new Date()) {
  return new BookingCheckInService(
    new BookingCheckInRepository(db),
    new SystemSettingsService(new SystemSettingsRepository(db)),
    clock,
  );
}
