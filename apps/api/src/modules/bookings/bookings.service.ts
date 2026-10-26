import { createHmac } from "node:crypto";
import type {
  BookingClosure,
  BookingConfirmation,
  BookingDraft,
  BookingDraftInput,
  BookingListItem,
  CustomerAvailability,
  CustomerBooking,
  CustomerBookingDetail,
  CustomerBookingPage,
  CustomerBookingPageQuery,
  EligibleUnit,
  PhysicalUnitAssignment,
  StaffTasksQuery,
} from "@metastorage/contracts";
import { BOOKING_ACCESS } from "@metastorage/shared/booking-access";
import {
  type BookingConfirmationEmailInput,
  encryptMailPayload,
  mailJobId,
} from "@metastorage/shared/mail";
import type { FastifyInstance } from "fastify";
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../common/errors/app-error";
import { env } from "../../config/env";
import { FacilitiesRepository } from "../facilities/facilities.repository";
import { FacilitiesService } from "../facilities/facilities.service";
import type { NotificationsService } from "../notifications/notifications.service";
import { PricingRepository } from "../pricing/pricing.repository";
import { PricingService } from "../pricing/pricing.service";
import { StorageUnitsRepository } from "../storage-units/storage-units.repository";
import { StorageUnitsService } from "../storage-units/storage-units.service";
import { FacilityUnitTypesRepository } from "../unit-types/facility-unit-types.repository";
import { FacilityUnitTypesService } from "../unit-types/facility-unit-types.service";
import { BOOKING_MESSAGES } from "./bookings.messages";
import { BookingsRepository, bookingLocalDate } from "./bookings.repository";
import type { BookingMailDependencies, BookingReadRecord } from "./bookings.types";
import { CheckInSlotsRepository } from "./check-in-slots.repository";
import { CheckInSlotsService } from "./check-in-slots.service";

export class BookingsService {
  constructor(
    private readonly repository: BookingsRepository,
    private readonly facilitiesService: FacilitiesService,
    private readonly facilityUnitTypesService: FacilityUnitTypesService,
    private readonly checkInSlotsService: CheckInSlotsService,
    private readonly storageUnitsService: StorageUnitsService,
    private readonly pricingService: PricingService,
    private readonly mail?: BookingMailDependencies,
    private readonly notifications?: NotificationsService,
  ) {}

  async cancelBooking(
    bookingId: string,
    credentials: { userId?: string },
  ): Promise<BookingClosure> {
    if (!credentials.userId)
      throw new UnauthorizedError(BOOKING_MESSAGES.cancellationAccessRequired);
    return this.repository.cancelBooking(bookingId, {
      userId: credentials.userId,
    });
  }

  async getStatus(bookingId: string): Promise<BookingConfirmation["emailStatus"]> {
    const durable = await this.repository.bookingEmailStatus(bookingId);
    if (durable?.status === "SENT") return "SENT";
    if (durable && ["SUPPRESSED", "REVIEW_REQUIRED"].includes(durable.status)) return "FAILED";
    const mail = this.mail;
    if (!mail) return durable ? "PENDING" : "FAILED";
    try {
      const job = await mail.queue.getJob(mailJobId(bookingId));
      if (!job) return durable ? "PENDING" : "FAILED";
      const state = await job.getState();
      return state === "completed" ? "SENT" : state === "failed" ? "FAILED" : "QUEUED";
    } catch {
      return "PENDING";
    }
  }

  async enqueueConfirmation(
    booking: Pick<BookingReadRecord, "id" | "paidAt" | "contactEmail" | "bookingCode">,
    confirmation: Pick<BookingConfirmation, "facility" | "unitTypeName">,
  ): Promise<BookingConfirmation["emailStatus"]> {
    // New payments persist the intent atomically. Only the dispatcher prepares its
    // frozen payload; legacy jobs keep their original producer and stable job ID.
    if (await this.repository.bookingEmailStatus(booking.id)) return this.getStatus(booking.id);
    const mail = this.mail;
    if (!mail) return "FAILED";
    try {
      const jobId = mailJobId(booking.id);
      if (await mail.queue.getJob(jobId)) return this.getStatus(booking.id);
      if (
        !booking.paidAt ||
        booking.paidAt.getTime() + BOOKING_ACCESS.magicTtl * 1000 <= Date.now()
      )
        return "FAILED";
      const input: BookingConfirmationEmailInput = {
        deliveryId: booking.id,
        recipientEmail: booking.contactEmail,
        bookingCode: booking.bookingCode,
        facilityName: confirmation.facility.name,
        unitTypeName: confirmation.unitTypeName,
        trackingUrl: new URL(`/customer/reservations/${booking.id}`, mail.config.publicAppUrl).href,
        qrUrl: `${new URL("/check-in", mail.config.publicAppUrl)}?token=${createHmac("sha256", mail.config.qrTokenSecret).update(booking.id).digest("hex")}`,
      };
      await mail.queue.add(
        "booking-confirmation",
        {
          deliveryId: booking.id,
          kind: "BOOKING_CONFIRMATION",
          payload: encryptMailPayload(
            JSON.stringify(input),
            mail.config.magicLinkSecret,
            booking.id,
          ),
          expiresAt: new Date(
            booking.paidAt.getTime() + BOOKING_ACCESS.magicTtl * 1000,
          ).toISOString(),
        },
        {
          jobId,
          attempts: 5,
          backoff: { type: "exponential", delay: 5000 },
          // Retain IDs through the link lifetime so payment replay cannot enqueue duplicates.
          removeOnComplete: { age: BOOKING_ACCESS.magicTtl },
          removeOnFail: { age: BOOKING_ACCESS.magicTtl },
        },
      );
      return "QUEUED";
    } catch {
      mail.config.onEnqueueFailure?.(booking.id);
      return "FAILED";
    }
  }

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
      return {
        ...booking,
        handoverStage,
        earlyCheckInAllowed: env.NODE_ENV === "development" || env.NODE_ENV === "develop",
      };
    });
  }

  private async resolveRentalPeriod(input: BookingDraftInput) {
    if (input.checkInDate <= bookingLocalDate())
      throw new AppError(BOOKING_MESSAGES.checkInTomorrow, 400, "CHECK_IN_TOMORROW_REQUIRED");
    await this.facilitiesService.requireActiveFacility(input.facilityId);
    const unitType = await this.facilityUnitTypesService.requireActiveUnitType(
      input.facilityId,
      input.unitTypeId,
    );
    const slot = await this.checkInSlotsService.findByIdForDate(
      input.checkInSlotId,
      input.checkInDate,
    );
    if (!slot) {
      throw new AppError(BOOKING_MESSAGES.invalidCheckInSlot, 400, "INVALID_CHECK_IN_SLOT", [
        { field: "checkInSlotId", message: BOOKING_MESSAGES.invalidCheckInSlot },
      ]);
    }
    if (slot.startsAt <= new Date())
      throw new AppError(BOOKING_MESSAGES.checkInInPast, 400, "CHECK_IN_IN_PAST", [
        { field: "checkInDate", message: BOOKING_MESSAGES.checkInInPast },
      ]);
    await this.facilitiesService.assertCheckInWithinOperatingHours(input.facilityId, slot.startsAt);
    const rentalEndAt = new Date(slot.startsAt);
    rentalEndAt.setUTCDate(rentalEndAt.getUTCDate() + input.durationMonths * 30);
    return { slot, unitType, rentalEndAt };
  }

  async availability(input: BookingDraftInput): Promise<CustomerAvailability> {
    const { slot, rentalEndAt } = await this.resolveRentalPeriod(input);
    const asOf = new Date().toISOString();
    const availableCount = await this.storageUnitsService.getAvailableCapacity(
      input.facilityId,
      input.unitTypeId,
      slot.startsAt,
      rentalEndAt,
    );
    return {
      facilityId: input.facilityId,
      unitTypeId: input.unitTypeId,
      period: { startsAt: slot.startsAt.toISOString(), endsAt: rentalEndAt.toISOString() },
      availableCount,
      asOf,
    };
  }

  async createDraft(input: BookingDraftInput, userId: string): Promise<BookingDraft> {
    const { slot, unitType, rentalEndAt } = await this.resolveRentalPeriod(input);
    const capacity = await this.storageUnitsService.getAvailableCapacity(
      input.facilityId,
      input.unitTypeId,
      slot.startsAt,
      rentalEndAt,
    );
    if (capacity < 1)
      throw new AppError(BOOKING_MESSAGES.unitTypeCapacityUnavailable, 409, "CAPACITY_UNAVAILABLE");

    const pricing = await this.pricingService.quote(unitType.id, input.durationMonths);
    const draft = await this.repository.createDraft({
      userId,
      facilityId: input.facilityId,
      unitTypeId: input.unitTypeId,
      checkInDate: slot.checkInDate,
      checkInSlotId: slot.id,
      rentalEndAt,
      requestedMonths: input.durationMonths,
      status: "DRAFT",
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

  async pageMine(userId: string, query: CustomerBookingPageQuery): Promise<CustomerBookingPage> {
    const rows = await this.repository.listCustomerBookings(userId, query);
    const pageRows = rows.slice(0, query.limit);
    const progress = await this.repository.handoverProgress(pageRows.map((booking) => booking.id));
    const latestProgress = new Map<string, (typeof progress)[number]>();
    for (const record of progress) {
      if (!latestProgress.has(record.bookingId)) latestProgress.set(record.bookingId, record);
    }
    const items: CustomerBooking[] = pageRows.map(({ cursorCreatedAt: _cursor, ...booking }) => ({
      ...booking,
      handoverStage:
        booking.status === "CHECKED_IN"
          ? "HANDED_OVER"
          : latestProgress.get(booking.id)?.status === "COMPLETED"
            ? "READY_HANDOVER"
            : latestProgress.has(booking.id)
              ? "INSPECTING"
              : "WAITING_CUSTOMER",
    }));
    const last = pageRows.at(-1);
    return {
      items,
      nextCursor:
        rows.length > query.limit && last
          ? { afterCreatedAt: last.cursorCreatedAt, afterId: last.id }
          : null,
    };
  }

  async getMine(bookingId: string, userId: string): Promise<CustomerBookingDetail> {
    const booking = await this.repository.findCustomerBookingById(bookingId, userId);
    if (!booking) throw new NotFoundError(BOOKING_MESSAGES.bookingDetailsNotFound);
    const progress = await this.repository.handoverProgress([booking.id]);
    const recovery = await this.repository.customerRecovery(booking.id, userId);
    const { cursorCreatedAt: _cursor, ...details } = booking;
    return {
      rentalId: recovery.rentalId,
      confirmation: recovery.confirmation
        ? { ...recovery.confirmation, emailStatus: await this.getStatus(booking.id) }
        : null,
      ...details,
      handoverStage:
        booking.status === "CHECKED_IN"
          ? "HANDED_OVER"
          : progress[0]?.status === "COMPLETED"
            ? "READY_HANDOVER"
            : progress[0]
              ? "INSPECTING"
              : "WAITING_CUSTOMER",
    };
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

    if (result.changed && this.notifications) {
      try {
        await this.notifications.assigned(bookingId, staffId);
      } catch {
        // Assignment already committed. Ephemeral delivery cannot roll it back.
        console.error("Staff notification delivery failed");
      }
    }
    const updatedBooking = await this.repository.findBookingById(bookingId);
    if (!updatedBooking) {
      throw new NotFoundError("Không tìm thấy đơn đặt chỗ sau khi cập nhật");
    }
    return updatedBooking;
  }

  async getStaffTasks(
    staffUserId: string,
    query: StaffTasksQuery = {},
  ): Promise<BookingListItem[]> {
    return this.withHandoverProgress(await this.repository.findStaffTasks(staffUserId, query));
  }
}

// Shared wiring for booking routes and payment-triggered booking confirmations.
export function createBookingsService(
  app: FastifyInstance,
  mail?: BookingMailDependencies,
): BookingsService {
  const facilitiesRepository = new FacilitiesRepository(app.db);
  return new BookingsService(
    new BookingsRepository(app.db),
    new FacilitiesService(facilitiesRepository),
    new FacilityUnitTypesService(new FacilityUnitTypesRepository(app.db), facilitiesRepository),
    new CheckInSlotsService(new CheckInSlotsRepository(app.db)),
    new StorageUnitsService(new StorageUnitsRepository(app.db)),
    new PricingService(new PricingRepository(app.db)),
    mail ??
      (app.redis && app.mailQueue
        ? {
            redis: app.redis,
            queue: app.mailQueue,
            config: {
              publicAppUrl: process.env.PUBLIC_APP_URL ?? "http://localhost:3000",
              magicLinkSecret: process.env.BOOKING_MAGIC_LINK_SECRET ?? "",
              qrTokenSecret: process.env.QR_TOKEN_SECRET ?? "storex-dev-qr-secret",
              onEnqueueFailure: (bookingId) =>
                app.log.error({ bookingId }, "Booking mail enqueue failed"),
            },
          }
        : undefined),
    app.notifications,
  );
}
