import { createHash, randomBytes } from "node:crypto";
import type {
  ReservationDraft,
  ReservationDraftContact,
  ReservationHold,
} from "@metastorage/contracts";
import { AppError, NotFoundError } from "../../common/errors/app-error";
import type { CheckInSlotsService } from "../bookings/check-in-slots.service";
import { RESERVATION_MESSAGES } from "./reservations.messages";
import type { ReservationsRepository } from "./reservations.repository";
import type { CreateReservationDraftBody } from "./reservations.schema";

const DEFAULT_OPEN_TIME = "06:00:00";
const DEFAULT_CLOSE_TIME = "22:00:00";
const TIMEZONE = "Asia/Ho_Chi_Minh";

function parseParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    dayOfWeek: weekdays.indexOf(get("weekday")),
    time: `${get("hour")}:${get("minute")}:00`,
  };
}

function addMonths(value: Date, months: number): Date {
  const result = new Date(value);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function isWithinHours(value: string, openTime: string, closeTime: string): boolean {
  return value >= openTime && value <= closeTime;
}

function toContact(contact: ReservationDraftContact): ReservationDraft["contact"] {
  return contact;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class ReservationsService {
  constructor(
    private readonly repository: ReservationsRepository,
    private readonly checkInSlotsService: CheckInSlotsService,
  ) {}

  async createDraft(input: CreateReservationDraftBody): Promise<ReservationDraft> {
    const context = await this.repository.findActiveContext(input.facilityId, input.unitTypeId);
    if (!context) throw new NotFoundError(RESERVATION_MESSAGES.facilityOrUnitTypeUnavailable);

    let checkInAt = new Date(input.checkInAt);
    const now = new Date();
    if (Number.isNaN(checkInAt.getTime()) || checkInAt <= now) {
      throw new AppError(RESERVATION_MESSAGES.checkInInPast, 400, "CHECK_IN_IN_PAST", [
        { field: "checkInAt", message: RESERVATION_MESSAGES.checkInInPast },
      ]);
    }

    const local = parseParts(checkInAt);
    const hours = await this.repository.findOperatingHours(input.facilityId, local.dayOfWeek);
    const openTime = hours?.openTime ?? DEFAULT_OPEN_TIME;
    const closeTime = hours?.closeTime ?? DEFAULT_CLOSE_TIME;
    if (!isWithinHours(local.time, openTime, closeTime)) {
      throw new AppError(
        RESERVATION_MESSAGES.checkInOutsideOperatingHours(openTime, closeTime),
        400,
        "CHECK_IN_OUTSIDE_HOURS",
        [
          {
            field: "checkInAt",
            message: RESERVATION_MESSAGES.checkInOutsideOperatingHours(openTime, closeTime),
          },
        ],
      );
    }

    const slot = await this.checkInSlotsService.findForCheckIn(checkInAt);
    if (!slot) {
      throw new AppError(RESERVATION_MESSAGES.checkInOutsideSlots, 400, "CHECK_IN_OUTSIDE_SLOTS");
    }
    checkInAt = slot.startsAt;
    if (checkInAt <= now) {
      throw new AppError(RESERVATION_MESSAGES.checkInInPast, 400, "CHECK_IN_IN_PAST", [
        { field: "checkInAt", message: RESERVATION_MESSAGES.checkInInPast },
      ]);
    }
    if (!isWithinHours(parseParts(checkInAt).time, openTime, closeTime)) {
      throw new AppError(
        RESERVATION_MESSAGES.checkInOutsideOperatingHours(openTime, closeTime),
        400,
        "CHECK_IN_OUTSIDE_HOURS",
        [
          {
            field: "checkInAt",
            message: RESERVATION_MESSAGES.checkInOutsideOperatingHours(openTime, closeTime),
          },
        ],
      );
    }

    const rentalEndAt = addMonths(checkInAt, input.durationMonths);
    const capacity = await this.repository.countCapacity(
      input.facilityId,
      input.unitTypeId,
      checkInAt,
      rentalEndAt,
    );
    if (capacity < 1) {
      throw new AppError(
        RESERVATION_MESSAGES.unitTypeCapacityUnavailable,
        409,
        "CAPACITY_UNAVAILABLE",
      );
    }

    const draftAccessToken = randomBytes(32).toString("hex");
    const monthlyPrice = context.unitType.monthlyPrice;
    const pricing = {
      monthlyRateSnapshot: String(monthlyPrice),
      rentalFeeAmount: String(monthlyPrice * input.durationMonths),
      depositAmount: String(monthlyPrice),
      totalAmount: String(monthlyPrice * (input.durationMonths + 1)),
      currency: "VND",
    };
    const draft = await this.repository.createDraft({
      facilityId: input.facilityId,
      unitTypeId: input.unitTypeId,
      checkInAt,
      rentalEndAt,
      durationMonths: input.durationMonths,
      contactName: input.contact.fullName,
      contactEmail: input.contact.email,
      contactPhone: input.contact.phone,
      accessTokenHash: hashToken(draftAccessToken),
      status: "DRAFT",
      pricingStatus: "PRICED",
      pricing,
    });

    return {
      id: draft.id,
      facilityId: draft.facilityId,
      unitTypeId: draft.unitTypeId,
      checkInAt: draft.checkInAt.toISOString(),
      rentalEndAt: draft.rentalEndAt.toISOString(),
      durationMonths: draft.durationMonths,
      contact: toContact({
        fullName: draft.contactName,
        email: draft.contactEmail,
        phone: draft.contactPhone,
      }),
      draftAccessToken,
      status: "DRAFT",
      pricingStatus: "PRICED",
      pricing,
    };
  }

  async createHold(draftId: string, draftAccessToken: string): Promise<ReservationHold> {
    const hold = await this.repository.createHold(draftId, hashToken(draftAccessToken));
    if (hold === null) throw new NotFoundError(RESERVATION_MESSAGES.reservationDraftNotFound);
    if (!hold) {
      throw new AppError(RESERVATION_MESSAGES.unitTypeCapacityUnavailable, 409, "HOLD_CONFLICT");
    }
    return {
      holdId: hold.id,
      holdToken: draftAccessToken,
      unitTypeId: hold.unitTypeId,
      startsAt: hold.startsAt.toISOString(),
      endsAt: hold.endsAt.toISOString(),
      expiresAt: hold.expiresAt?.toISOString() ?? new Date(0).toISOString(),
      status: "ACTIVE",
    };
  }
}
