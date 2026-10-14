import { createHash, createHmac, randomBytes } from "node:crypto";
import type {
  BookingConfirmation,
  BookingDraft,
  BookingDraftInput,
  BookingListItem,
  BookingTracking,
  BookingTrackingSession,
  EligibleUnit,
  PhysicalUnitAssignment,
} from "@metastorage/contracts";
import {
  BOOKING_ACCESS,
  type BookingAccessGrant,
  type BookingAccessSession,
  bookingMagicKey,
  bookingSessionKey,
} from "@metastorage/shared/booking-access";
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
  ValidationError,
} from "../../common/errors/app-error";
import type { RedisService } from "../../common/redis/redis.service";
import { env } from "../../config/env";
import { FacilitiesRepository } from "../facilities/facilities.repository";
import { FacilitiesService } from "../facilities/facilities.service";
import { StorageUnitsRepository } from "../storage-units/storage-units.repository";
import { StorageUnitsService } from "../storage-units/storage-units.service";
import { FacilityUnitTypesRepository } from "../unit-types/facility-unit-types.repository";
import { FacilityUnitTypesService } from "../unit-types/facility-unit-types.service";
import { BOOKING_MESSAGES } from "./bookings.messages";
import {
  BookingsRepository,
  bookingLocalDate,
  createBookingTrackingLink,
} from "./bookings.repository";
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
    private readonly accessRedis?: RedisService,
    private readonly mail?: BookingMailDependencies,
  ) {}

  async getStatus(bookingId: string): Promise<BookingConfirmation["emailStatus"]> {
    const mail = this.mail;
    if (!mail) return "FAILED";
    try {
      const job = await mail.queue.getJob(mailJobId(bookingId));
      if (!job) return "FAILED";
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
      const link = await createBookingTrackingLink(mail.redis, {
        deliveryId: booking.id,
        bookingId: booking.id,
        secret: mail.config.magicLinkSecret,
        publicAppUrl: mail.config.publicAppUrl,
        confirmedAt: booking.paidAt,
      });
      const input: BookingConfirmationEmailInput = {
        deliveryId: booking.id,
        recipientEmail: booking.contactEmail,
        bookingCode: booking.bookingCode,
        facilityName: confirmation.facility.name,
        unitTypeName: confirmation.unitTypeName,
        trackingUrl: link.trackingUrl,
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
          expiresAt: link.expiresAt,
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
      return { ...booking, handoverStage };
    });
  }

  private async withAccessRedis<T>(work: (redis: RedisService) => Promise<T>): Promise<T> {
    if (!this.accessRedis) throw new AppError(BOOKING_MESSAGES.accessUnavailable, 503);
    try {
      return await work(this.accessRedis);
    } catch (error) {
      if (error instanceof AppError) throw error;
      // Redis errors can contain command arguments. Never attach them to public errors or logs.
      throw new AppError(BOOKING_MESSAGES.accessUnavailable, 503);
    }
  }

  async exchangeMagicLink(
    token: string,
    ip: string,
    previousSession?: string,
  ): Promise<{ sessionToken: string; session: BookingTrackingSession }> {
    return this.withAccessRedis(async (redis) => {
      const ipHash = createHmac("sha256", env.BETTER_AUTH_SECRET).update(ip).digest("hex");
      if (
        (await redis.incrementWithExpiry(
          `booking:rate:exchange:${ipHash}`,
          BOOKING_ACCESS.rateWindow,
        )) > BOOKING_ACCESS.rateLimit
      ) {
        throw new AppError(BOOKING_MESSAGES.accessRateLimited, 429);
      }
      const raw = await redis.get(bookingMagicKey(token));
      if (!raw) throw new AppError(BOOKING_MESSAGES.accessInvalid, 401);
      const grant = JSON.parse(raw) as BookingAccessGrant;
      if (!grant.bookingId || !(Date.parse(grant.expiresAt) > Date.now()))
        throw new AppError(BOOKING_MESSAGES.accessInvalid, 401);
      const booking = await this.repository.findTrackingBooking(grant.bookingId);
      if (!booking) throw new AppError(BOOKING_MESSAGES.accessInvalid, 401);
      const sessionToken = randomBytes(32).toString("hex");
      const session: BookingAccessSession = {
        bookingId: grant.bookingId,
        bookingCode: booking.bookingCode,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + BOOKING_ACCESS.sessionTtl * 1000).toISOString(),
      };
      await redis.set(
        bookingSessionKey(sessionToken),
        JSON.stringify(session),
        BOOKING_ACCESS.sessionTtl,
      );
      if (previousSession) await redis.delete(bookingSessionKey(previousSession));
      return {
        sessionToken,
        session: { bookingCode: session.bookingCode, expiresAt: session.expiresAt, booking },
      };
    });
  }

  async getTrackingBooking(bookingCode: string, sessionToken?: string): Promise<BookingTracking> {
    return this.withAccessRedis(async (redis) => {
      const raw = sessionToken ? await redis.get(bookingSessionKey(sessionToken)) : null;
      if (!raw) throw new AppError(BOOKING_MESSAGES.accessInvalid, 401);
      const session = JSON.parse(raw) as BookingAccessSession;
      if (!session.bookingId || !(Date.parse(session.expiresAt) > Date.now()))
        throw new AppError(BOOKING_MESSAGES.accessInvalid, 401);
      if (session.bookingCode !== bookingCode)
        throw new NotFoundError(BOOKING_MESSAGES.bookingNotFound);
      const booking = await this.repository.findTrackingBooking(session.bookingId);
      if (!booking || booking.bookingCode !== bookingCode)
        throw new NotFoundError(BOOKING_MESSAGES.bookingNotFound);
      return booking;
    });
  }

  async revokeTrackingSession(sessionToken?: string): Promise<void> {
    await this.withAccessRedis(async (redis) => {
      if (sessionToken) await redis.delete(bookingSessionKey(sessionToken));
    });
  }

  async createDraft(input: BookingDraftInput, userId?: string): Promise<BookingDraft> {
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
    app.redisService,
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
  );
}
