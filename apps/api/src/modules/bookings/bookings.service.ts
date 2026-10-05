import { createHash, randomBytes } from "node:crypto";
import type {
  BookingDraft,
  BookingDraftInput,
  BookingListItem,
  EligibleUnit,
  PhysicalUnitAssignment,
} from "@metastorage/contracts";
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../common/errors/app-error";
import type { FacilitiesService } from "../facilities/facilities.service";
import type { StorageUnitsService } from "../storage-units/storage-units.service";
import type { FacilityUnitTypesService } from "../unit-types/facility-unit-types.service";
import { BOOKING_MESSAGES } from "./bookings.messages";
import type { BookingsRepository } from "./bookings.repository";
import type { CheckInSlotsService } from "./check-in-slots.service";

export class BookingsService {
  constructor(
    private readonly repository: BookingsRepository,
    private readonly facilitiesService: FacilitiesService,
    private readonly facilityUnitTypesService: FacilityUnitTypesService,
    private readonly checkInSlotsService: CheckInSlotsService,
    private readonly storageUnitsService: StorageUnitsService,
  ) {}

  private async withHandoverProgress(bookings: BookingListItem[]): Promise<BookingListItem[]> {
    const records = await this.repository.handoverProgress(bookings.map((b) => b.id));
    return bookings.map((booking) => {
      const record = records.find((r) => r.bookingId === booking.id);
      const handoverStage: BookingListItem["handoverStage"] =
        booking.status === "CHECKED_IN"
          ? "HANDED_OVER"
          : record?.status === "COMPLETED"
            ? "READY_HANDOVER"
            : record
              ? "INSPECTING"
              : "WAITING_CUSTOMER";
      return { ...booking, handoverStage };
    });
  }

  async createDraft(input: BookingDraftInput, userId?: string): Promise<BookingDraft> {
    await this.facilitiesService.requireActiveFacility(input.facilityId);
    const unitType = await this.facilityUnitTypesService.requireActiveUnitType(
      input.facilityId,
      input.unitTypeId,
    );
    const requestedAt = new Date(input.checkInAt);
    const now = new Date();
    if (Number.isNaN(requestedAt.getTime()) || requestedAt <= now) {
      throw new AppError(BOOKING_MESSAGES.checkInInPast, 400, "CHECK_IN_IN_PAST");
    }
    await this.facilitiesService.assertCheckInWithinOperatingHours(input.facilityId, requestedAt);
    const slot = await this.checkInSlotsService.findForCheckIn(requestedAt);
    if (!slot)
      throw new AppError(BOOKING_MESSAGES.checkInOutsideSlots, 400, "CHECK_IN_OUTSIDE_SLOTS");
    if (slot.startsAt <= now)
      throw new AppError(BOOKING_MESSAGES.checkInInPast, 400, "CHECK_IN_IN_PAST");
    await this.facilitiesService.assertCheckInWithinOperatingHours(input.facilityId, slot.startsAt);
    const rentalEndAt = new Date(slot.startsAt);
    rentalEndAt.setUTCMonth(rentalEndAt.getUTCMonth() + input.durationMonths);
    const capacity = await this.storageUnitsService.getAvailableCapacity(
      input.facilityId,
      input.unitTypeId,
      slot.startsAt,
      rentalEndAt,
    );
    if (capacity < 1)
      throw new AppError(BOOKING_MESSAGES.unitTypeCapacityUnavailable, 409, "CAPACITY_UNAVAILABLE");

    const draftAccessToken = randomBytes(32).toString("hex");
    const pricing: BookingDraft["pricing"] = {
      monthlyRateSnapshot: String(unitType.monthlyPrice),
      rentalFeeAmount: String(unitType.monthlyPrice * input.durationMonths),
      depositAmount: String(unitType.monthlyPrice),
      totalAmount: String(unitType.monthlyPrice * (input.durationMonths + 1)),
      currency: "VND",
    };
    const draft = await this.repository.createDraft({
      userId: userId ?? null,
      facilityId: input.facilityId,
      unitTypeId: input.unitTypeId,
      checkInDate: slot.checkInDate,
      checkInSlotId: slot.id,
      rentalEndAt,
      requestedMonths: input.durationMonths,
      status: "DRAFT",
      accessTokenHash: createHash("sha256").update(draftAccessToken).digest("hex"),
      monthlyRateSnapshot: pricing.monthlyRateSnapshot,
      rentalFeeAmount: pricing.rentalFeeAmount,
      depositAmount: pricing.depositAmount,
      totalAmount: pricing.totalAmount,
    });
    return {
      id: draft.id,
      facilityId: draft.facilityId,
      unitTypeId: draft.unitTypeId,
      checkInAt: slot.startsAt.toISOString(),
      rentalEndAt: draft.rentalEndAt.toISOString(),
      durationMonths: draft.requestedMonths,
      draftAccessToken,
      status: "DRAFT",
      pricing,
    };
  }

  async getFacilityBookings(facilityId: string, status?: string): Promise<BookingListItem[]> {
    return this.withHandoverProgress(
      await this.repository.findFacilityBookings(facilityId, status),
    );
  }

  async getBookingById(bookingId: string): Promise<BookingListItem> {
    const booking = await this.repository.findBookingById(bookingId);
    if (!booking) {
      throw new NotFoundError(BOOKING_MESSAGES.bookingDetailsNotFound);
    }
    return booking;
  }

  async getEligibleUnits(bookingId: string): Promise<EligibleUnit[]> {
    const booking = await this.repository.findBookingById(bookingId);
    if (!booking) {
      throw new NotFoundError(BOOKING_MESSAGES.bookingDetailsNotFound);
    }

    return this.repository.findEligibleUnits(
      booking.facilityId,
      booking.unitTypeId,
      booking.id,
      new Date(booking.checkInSlotStart),
      new Date(booking.rentalEndAt),
    );
  }

  async assignPhysicalUnit(
    bookingId: string,
    physicalUnitId: string,
    assignedByUserId: string,
    reason?: string,
  ): Promise<PhysicalUnitAssignment> {
    const result = await this.repository.assignPhysicalUnit(
      bookingId,
      physicalUnitId,
      assignedByUserId,
      reason,
    );

    if ("error" in result) {
      switch (result.error) {
        case "BOOKING_NOT_FOUND":
          throw new NotFoundError(BOOKING_MESSAGES.bookingNotFound);
        case "PHYSICAL_UNIT_NOT_FOUND":
          throw new NotFoundError(BOOKING_MESSAGES.physicalUnitNotFound);
        case "INVALID_BOOKING_STATUS":
          throw new BadRequestError(BOOKING_MESSAGES.invalidBookingStatus(result.currentStatus));
        case "UNIT_TYPE_OR_FACILITY_MISMATCH":
          throw new ValidationError(BOOKING_MESSAGES.physicalUnitDoesNotMatchReservation);
        case "UNIT_STATUS_INVALID":
          throw new BadRequestError(BOOKING_MESSAGES.physicalUnitUnavailable(result.unitStatus));
        case "UNIT_RENTAL_CONFLICT":
          throw new ConflictError(BOOKING_MESSAGES.physicalUnitRentalConflict);
        case "UNIT_ASSIGNMENT_CONFLICT":
          throw new ConflictError(BOOKING_MESSAGES.physicalUnitAssignmentConflict);
        default:
          throw new AppError(BOOKING_MESSAGES.physicalUnitAssignmentFailed, 500);
      }
    }

    return result.assignment;
  }

  async assignStaff(bookingId: string, staffId: string): Promise<BookingListItem> {
    const result = await this.repository.assignStaff(bookingId, staffId);

    if ("error" in result) {
      switch (result.error) {
        case "INVALID_BOOKING_STATUS":
          throw new ConflictError(BOOKING_MESSAGES.staffAssignmentClosed);
        case "BOOKING_NOT_FOUND":
          throw new NotFoundError("Không tìm thấy đơn đặt chỗ");
        case "STAFF_NOT_IN_FACILITY":
          throw new BadRequestError(
            "Nhân viên được chọn không thuộc cơ sở này hoặc không có vai trò phù hợp",
          );
        case "STAFF_INACTIVE":
          throw new BadRequestError("Tài khoản nhân viên đang bị vô hiệu hóa (Inactive)");
        default:
          throw new AppError("Không thể chỉ định nhân viên phụ trách", 500);
      }
    }

    const updatedBooking = await this.repository.findBookingById(bookingId);
    if (!updatedBooking) {
      throw new NotFoundError("Không tìm thấy đơn đặt chỗ sau khi cập nhật");
    }
    return updatedBooking;
  }

  async getStaffTasks(staffUserId: string, facilityId?: string): Promise<BookingListItem[]> {
    return this.withHandoverProgress(await this.repository.findStaffTasks(staffUserId, facilityId));
  }
}
