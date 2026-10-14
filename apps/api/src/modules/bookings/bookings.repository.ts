import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import {
  type BookingClosure,
  type BookingListItem,
  type BookingTracking,
  type EligibleUnit,
  type FacilityStaffMember,
  type PhysicalUnitAssignment,
  UserRole,
} from "@metastorage/contracts";
import {
  aliasedTable,
  and,
  bookings,
  capacityAllocations,
  checkInSlots,
  checkInVerifications,
  type Database,
  desc,
  eq,
  exists,
  facilities,
  facilityAssignments,
  getTableColumns,
  gt,
  handoverInspections,
  inArray,
  isNotNull,
  lt,
  lte,
  max,
  type NewBooking,
  ne,
  notExists,
  notInArray,
  or,
  payments,
  rentals,
  sql,
  storageUnits,
  unitAssignments,
  unitTypes,
  users,
} from "@metastorage/database";
import {
  BOOKING_ACCESS,
  bookingDeliveryKey,
  bookingMagicKey,
} from "@metastorage/shared/booking-access";
import { BOOKING_EMAIL_MESSAGES } from "@metastorage/shared/mail";
import type Redis from "ioredis";
import { AppError } from "../../common/errors/app-error";
import { BOOKING_MESSAGES } from "./bookings.messages";
import type {
  BookingCancellationAccess,
  BookingTrackingLinkInput,
  BookingTransaction,
  EncryptedBookingDelivery,
} from "./bookings.types";
import { CheckInSlotsRepository } from "./check-in-slots.repository";

const assignedStaffUsers = aliasedTable(users, "assigned_staff_users");

export function bookingCode() {
  return `SX-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export function bookingLocalDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function hashQrToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function qrTokenForBooking(bookingId: string) {
  return createHmac("sha256", process.env.QR_TOKEN_SECRET ?? "storex-dev-qr-secret")
    .update(bookingId)
    .digest("hex");
}

export async function createBookingTrackingLink(
  redis: Redis,
  input: BookingTrackingLinkInput,
): Promise<{ trackingUrl: string; expiresAt: string }> {
  if (input.secret.length < 32) throw new Error(BOOKING_EMAIL_MESSAGES.accessConfiguration);
  const appUrl = new URL(input.publicAppUrl);
  if (!["http:", "https:"].includes(appUrl.protocol) || appUrl.username || appUrl.password)
    throw new Error(BOOKING_EMAIL_MESSAGES.accessConfiguration);
  const encryptionKey = createHash("sha256").update(input.secret).digest();
  const deliveryKey = bookingDeliveryKey(input.deliveryId);
  let raw = await redis.get(deliveryKey);
  if (!raw) {
    const token = randomBytes(32).toString("hex");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
    cipher.setAAD(Buffer.from(`${input.deliveryId}:${input.bookingId}`));
    const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    const delivery: EncryptedBookingDelivery = {
      ciphertext: ciphertext.toString("hex"),
      iv: iv.toString("hex"),
      tag: cipher.getAuthTag().toString("hex"),
      bookingId: input.bookingId,
      createdAt: input.confirmedAt.toISOString(),
      expiresAt: new Date(
        input.confirmedAt.getTime() + BOOKING_ACCESS.magicTtl * 1000,
      ).toISOString(),
    };
    // Return the winner atomically. A retry can recover after a crash before grant creation.
    raw = String(
      await redis.eval(
        "if redis.call('EXISTS', KEYS[1]) == 0 then redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2]); end; return redis.call('GET', KEYS[1])",
        1,
        deliveryKey,
        JSON.stringify(delivery),
        Math.max(
          1,
          Math.ceil(
            (input.confirmedAt.getTime() + BOOKING_ACCESS.magicTtl * 1000 - Date.now()) / 1000,
          ),
        ),
      ),
    );
  }
  const delivery = JSON.parse(raw) as EncryptedBookingDelivery;
  const ttl = Math.floor((Date.parse(delivery.expiresAt) - Date.now()) / 1000);
  if (delivery.bookingId !== input.bookingId || ttl <= 0)
    throw new Error(BOOKING_EMAIL_MESSAGES.accessExpired);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(delivery.iv, "hex"));
  decipher.setAAD(Buffer.from(`${input.deliveryId}:${input.bookingId}`));
  decipher.setAuthTag(Buffer.from(delivery.tag, "hex"));
  const token = Buffer.concat([
    decipher.update(Buffer.from(delivery.ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
  await redis.set(
    bookingMagicKey(token),
    JSON.stringify({
      bookingId: input.bookingId,
      createdAt: delivery.createdAt,
      expiresAt: delivery.expiresAt,
    }),
    "EX",
    ttl,
    "NX",
  );
  const url = new URL("/booking/tracking", appUrl);
  url.hash = `token=${token}`;
  return { trackingUrl: url.toString(), expiresAt: delivery.expiresAt };
}

export class BookingsRepository {
  constructor(private readonly db: Database) {}

  async cancelBooking(
    bookingId: string,
    access: BookingCancellationAccess,
  ): Promise<BookingClosure> {
    if (!access.userId && !access.tokenHash)
      throw new AppError(BOOKING_MESSAGES.cancellationAccessRequired, 401);
    return this.db.transaction(async (tx) => {
      const [owned] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.id, bookingId),
            or(
              access.userId ? eq(bookings.userId, access.userId) : undefined,
              access.tokenHash ? eq(bookings.accessTokenHash, access.tokenHash) : undefined,
            ),
          ),
        )
        .for("update");
      if (!owned) throw new AppError(BOOKING_MESSAGES.bookingNotFound, 404);
      const result = await closeBookingBeforeCheckIn(tx, bookingId, "CANCELLED", new Date());
      if (!result) throw new AppError(BOOKING_MESSAGES.cancellationClosed, 409);
      return result;
    });
  }

  async sweepNoShows(now = new Date()) {
    return this.db.transaction(async (tx) => {
      const dayEnd = sql`(${bookings.checkInDate} +
        (${tx.select({ end: max(checkInSlots.endTime) }).from(checkInSlots)}))
        at time zone 'Asia/Ho_Chi_Minh'`;
      const candidates = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.status, "CONFIRMED"),
            lte(bookings.checkInDate, bookingLocalDate(now)),
            lte(dayEnd, now.toISOString()),
            exists(
              tx
                .select({ id: payments.id })
                .from(payments)
                .where(and(eq(payments.bookingId, bookings.id), eq(payments.status, "SUCCEEDED"))),
            ),
            notExists(
              tx.select({ id: rentals.id }).from(rentals).where(eq(rentals.bookingId, bookings.id)),
            ),
          ),
        )
        .orderBy(bookings.checkInDate, bookings.id)
        .limit(100)
        .for("update", { skipLocked: true });
      let processed = 0;
      for (const booking of candidates) {
        if (await closeBookingBeforeCheckIn(tx, booking.id, "NO_SHOW", now)) processed++;
      }
      return { processed };
    });
  }

  async findTrackingBooking(bookingId: string): Promise<BookingTracking | null> {
    const [row] = await this.db
      .select({
        bookingCode: bookings.bookingCode,
        status: bookings.status,
        contactName: bookings.contactName,
        contactEmail: bookings.contactEmail,
        contactPhone: bookings.contactPhone,
        facility: { name: facilities.name, address: facilities.address },
        unitType: { name: unitTypes.name, sizeLabel: unitTypes.sizeLabel },
        checkInSlotStart:
          sql<Date>`(${bookings.checkInDate} + ${checkInSlots.startTime}) at time zone 'Asia/Ho_Chi_Minh'`.mapWith(
            (value) => new Date(value),
          ),
        checkInSlotEnd:
          sql<Date>`(${bookings.checkInDate} + ${checkInSlots.endTime}) at time zone 'Asia/Ho_Chi_Minh'`.mapWith(
            (value) => new Date(value),
          ),
        rentalEndAt: bookings.rentalEndAt,
        durationMonths: bookings.requestedMonths,
        monthlyRateSnapshot: bookings.monthlyRateSnapshot,
        rentalFeeAmount: bookings.rentalFeeAmount,
        depositAmount: bookings.depositAmount,
        totalAmount: bookings.totalAmount,
        paymentStatus: payments.status,
        refundAmount: payments.refundAmount,
        depositForfeitedAmount: payments.depositForfeitedAmount,
        paidAt: payments.paidAt,
      })
      .from(bookings)
      .innerJoin(facilities, eq(facilities.id, bookings.facilityId))
      .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
      .innerJoin(checkInSlots, eq(checkInSlots.id, bookings.checkInSlotId))
      .innerJoin(payments, eq(payments.bookingId, bookings.id))
      .where(
        and(
          eq(bookings.id, bookingId),
          inArray(bookings.status, ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"]),
          inArray(payments.status, ["SUCCEEDED", "REFUND_PENDING", "REFUNDED"]),
          isNotNull(payments.paidAt),
        ),
      )
      .orderBy(desc(payments.paidAt), desc(payments.id))
      .limit(1);
    if (
      !row?.bookingCode ||
      !row.contactName ||
      !row.contactEmail ||
      !row.contactPhone ||
      !row.paidAt
    )
      return null;
    return {
      bookingCode: row.bookingCode,
      status: row.status as BookingTracking["status"],
      facility: row.facility,
      unitType: row.unitType,
      checkInSlotStart: row.checkInSlotStart.toISOString(),
      checkInSlotEnd: row.checkInSlotEnd.toISOString(),
      rentalEndAt: row.rentalEndAt.toISOString(),
      durationMonths: row.durationMonths,
      contact: { fullName: row.contactName, email: row.contactEmail, phone: row.contactPhone },
      pricing: {
        monthlyRateSnapshot: row.monthlyRateSnapshot,
        rentalFeeAmount: row.rentalFeeAmount,
        depositAmount: row.depositAmount,
        totalAmount: row.totalAmount,
        currency: "VND",
      },
      payment: {
        status: row.paymentStatus as BookingTracking["payment"]["status"],
        paidAt: row.paidAt.toISOString(),
        refundAmount:
          row.refundAmount ?? (row.paymentStatus !== "SUCCEEDED" ? row.totalAmount : null),
        depositForfeitedAmount: row.depositForfeitedAmount,
      },
    };
  }

  async createDraft(data: NewBooking) {
    const [draft] = await this.db.insert(bookings).values(data).returning();
    if (!draft) throw new Error(BOOKING_MESSAGES.failedToCreateDraft);
    return draft;
  }

  async findFacilityBookings(facilityId: string, status?: string): Promise<BookingListItem[]> {
    const conditions = [eq(bookings.facilityId, facilityId), ne(bookings.status, "DRAFT")];
    if (status) {
      conditions.push(eq(bookings.status, status));
    }

    const slotStart = sql<Date>`(${bookings.checkInDate} + ${checkInSlots.startTime})
      at time zone 'Asia/Ho_Chi_Minh'`.mapWith((value) => new Date(value));
    const slotEnd = sql<Date>`(${bookings.checkInDate} + ${checkInSlots.endTime})
      at time zone 'Asia/Ho_Chi_Minh'`.mapWith((value) => new Date(value));
    const paidPayments = this.db
      .select({
        bookingId: payments.bookingId,
        paidAt: sql<Date | null>`min(${payments.paidAt})`
          .mapWith((value) => (value === null ? null : new Date(value)))
          .as("paid_at"),
      })
      .from(payments)
      .where(inArray(payments.status, ["SUCCEEDED", "REFUND_PENDING", "REFUNDED"]))
      .groupBy(payments.bookingId)
      .as("booking_payments");

    const rows = await this.db
      .select({
        booking: {
          ...getTableColumns(bookings),
          contactName: sql<string>`${bookings.contactName}`,
          contactEmail: sql<string>`${bookings.contactEmail}`,
          contactPhone: sql<string>`${bookings.contactPhone}`,
        },
        checkInSlotStart: slotStart,
        checkInSlotEnd: slotEnd,
        paidAt: paidPayments.paidAt,
        facility: facilities,
        unitType: unitTypes,
        assignment: unitAssignments,
        assignedUnit: storageUnits,
        assigner: users,
        assignedStaff: assignedStaffUsers,
      })
      .from(bookings)
      .innerJoin(checkInSlots, eq(bookings.checkInSlotId, checkInSlots.id))
      .leftJoin(paidPayments, eq(paidPayments.bookingId, bookings.id))
      .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
      .innerJoin(unitTypes, eq(bookings.unitTypeId, unitTypes.id))
      .leftJoin(
        unitAssignments,
        and(eq(unitAssignments.bookingId, bookings.id), eq(unitAssignments.status, "ACTIVE")),
      )
      .leftJoin(storageUnits, eq(unitAssignments.physicalUnitId, storageUnits.id))
      .leftJoin(users, eq(unitAssignments.assignedBy, users.id))
      .leftJoin(assignedStaffUsers, eq(bookings.assignedStaffId, assignedStaffUsers.id))
      .where(and(...conditions))
      .orderBy(slotStart);

    return rows.map(
      ({
        booking,
        checkInSlotStart,
        checkInSlotEnd,
        paidAt,
        facility,
        unitType,
        assignment,
        assignedUnit,
        assigner,
        assignedStaff,
      }) => {
        let activeAssignment: PhysicalUnitAssignment | null = null;
        if (assignment && assignedUnit) {
          activeAssignment = {
            id: assignment.id,
            bookingId: assignment.bookingId,
            physicalUnitId: assignment.physicalUnitId,
            physicalUnitCode: assignedUnit.code,
            assignedBy: assignment.assignedBy,
            assignerName: assigner?.name ?? undefined,
            status: assignment.status as "ACTIVE" | "REASSIGNED" | "CANCELLED",
            assignedAt: assignment.assignedAt.toISOString(),
            endedAt: assignment.endedAt?.toISOString() ?? null,
            reason: assignment.reason ?? null,
          };
        }

        let staffMember: FacilityStaffMember | null = null;
        if (assignedStaff) {
          staffMember = {
            id: assignedStaff.id,
            name: assignedStaff.name,
            email: assignedStaff.email,
            phone: assignedStaff.phone ?? null,
            role: UserRole.FACILITY_STAFF,
            isActive: assignedStaff.status === "ACTIVE",
          };
        }

        return {
          id: booking.id,
          bookingCode: booking.bookingCode ?? booking.id.slice(0, 8).toUpperCase(),
          facilityId: booking.facilityId,
          facilityName: facility.name,
          unitTypeId: booking.unitTypeId,
          unitTypeName: unitType.name,
          unitTypeSizeLabel: unitType.sizeLabel,
          contactName: booking.contactName,
          contactEmail: booking.contactEmail,
          contactPhone: booking.contactPhone,
          checkInSlotStart: checkInSlotStart.toISOString(),
          checkInSlotEnd: checkInSlotEnd?.toISOString() ?? null,
          rentalEndAt: booking.rentalEndAt.toISOString(),
          requestedMonths: booking.requestedMonths,
          totalAmount: Number(booking.totalAmount),
          status: booking.status as "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "CHECKED_IN",
          paidAt: paidAt?.toISOString() ?? null,
          assignedUnit: activeAssignment,
          assignedStaff: staffMember,
          createdAt: booking.createdAt.toISOString(),
        };
      },
    );
  }

  async findBookingById(bookingId: string): Promise<BookingListItem | null> {
    const slotStart = sql<Date>`(${bookings.checkInDate} + ${checkInSlots.startTime})
      at time zone 'Asia/Ho_Chi_Minh'`.mapWith((value) => new Date(value));
    const slotEnd = sql<Date>`(${bookings.checkInDate} + ${checkInSlots.endTime})
      at time zone 'Asia/Ho_Chi_Minh'`.mapWith((value) => new Date(value));
    const paidPayments = this.db
      .select({
        bookingId: payments.bookingId,
        paidAt: sql<Date | null>`min(${payments.paidAt})`
          .mapWith((value) => (value === null ? null : new Date(value)))
          .as("paid_at"),
      })
      .from(payments)
      .where(inArray(payments.status, ["SUCCEEDED", "REFUND_PENDING", "REFUNDED"]))
      .groupBy(payments.bookingId)
      .as("booking_payments");

    const [row] = await this.db
      .select({
        booking: {
          ...getTableColumns(bookings),
          contactName: sql<string>`${bookings.contactName}`,
          contactEmail: sql<string>`${bookings.contactEmail}`,
          contactPhone: sql<string>`${bookings.contactPhone}`,
        },
        checkInSlotStart: slotStart,
        checkInSlotEnd: slotEnd,
        paidAt: paidPayments.paidAt,
        facility: facilities,
        unitType: unitTypes,
        assignment: unitAssignments,
        assignedUnit: storageUnits,
        assigner: users,
        assignedStaff: assignedStaffUsers,
      })
      .from(bookings)
      .innerJoin(checkInSlots, eq(bookings.checkInSlotId, checkInSlots.id))
      .leftJoin(paidPayments, eq(paidPayments.bookingId, bookings.id))
      .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
      .innerJoin(unitTypes, eq(bookings.unitTypeId, unitTypes.id))
      .leftJoin(
        unitAssignments,
        and(eq(unitAssignments.bookingId, bookings.id), eq(unitAssignments.status, "ACTIVE")),
      )
      .leftJoin(storageUnits, eq(unitAssignments.physicalUnitId, storageUnits.id))
      .leftJoin(users, eq(unitAssignments.assignedBy, users.id))
      .leftJoin(assignedStaffUsers, eq(bookings.assignedStaffId, assignedStaffUsers.id))
      .where(and(eq(bookings.id, bookingId), ne(bookings.status, "DRAFT")));

    if (!row) return null;

    const {
      booking,
      checkInSlotStart,
      checkInSlotEnd,
      paidAt,
      facility,
      unitType,
      assignment,
      assignedUnit,
      assigner,
      assignedStaff,
    } = row;
    let activeAssignment: PhysicalUnitAssignment | null = null;
    if (assignment && assignedUnit) {
      activeAssignment = {
        id: assignment.id,
        bookingId: assignment.bookingId,
        physicalUnitId: assignment.physicalUnitId,
        physicalUnitCode: assignedUnit.code,
        assignedBy: assignment.assignedBy,
        assignerName: assigner?.name ?? undefined,
        status: assignment.status as "ACTIVE" | "REASSIGNED" | "CANCELLED",
        assignedAt: assignment.assignedAt.toISOString(),
        endedAt: assignment.endedAt?.toISOString() ?? null,
        reason: assignment.reason ?? null,
      };
    }

    let staffMember: FacilityStaffMember | null = null;
    if (assignedStaff) {
      staffMember = {
        id: assignedStaff.id,
        name: assignedStaff.name,
        email: assignedStaff.email,
        phone: assignedStaff.phone ?? null,
        role: UserRole.FACILITY_STAFF,
        isActive: assignedStaff.status === "ACTIVE",
      };
    }

    return {
      id: booking.id,
      bookingCode: booking.bookingCode ?? booking.id.slice(0, 8).toUpperCase(),
      facilityId: booking.facilityId,
      facilityName: facility.name,
      unitTypeId: booking.unitTypeId,
      unitTypeName: unitType.name,
      unitTypeSizeLabel: unitType.sizeLabel,
      contactName: booking.contactName,
      contactEmail: booking.contactEmail,
      contactPhone: booking.contactPhone,
      checkInSlotStart: checkInSlotStart.toISOString(),
      checkInSlotEnd: checkInSlotEnd?.toISOString() ?? null,
      rentalEndAt: booking.rentalEndAt.toISOString(),
      requestedMonths: booking.requestedMonths,
      totalAmount: Number(booking.totalAmount),
      status: booking.status as "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "CHECKED_IN",
      paidAt: paidAt?.toISOString() ?? null,
      assignedUnit: activeAssignment,
      assignedStaff: staffMember,
      createdAt: booking.createdAt.toISOString(),
    };
  }

  async findStaffTasks(staffUserId: string, facilityId?: string): Promise<BookingListItem[]> {
    const conditions = [eq(bookings.assignedStaffId, staffUserId), ne(bookings.status, "DRAFT")];
    if (facilityId) {
      conditions.push(eq(bookings.facilityId, facilityId));
    }

    const slotStart = sql<Date>`(${bookings.checkInDate} + ${checkInSlots.startTime})
      at time zone 'Asia/Ho_Chi_Minh'`.mapWith((value) => new Date(value));
    const slotEnd = sql<Date>`(${bookings.checkInDate} + ${checkInSlots.endTime})
      at time zone 'Asia/Ho_Chi_Minh'`.mapWith((value) => new Date(value));
    const paidPayments = this.db
      .select({
        bookingId: payments.bookingId,
        paidAt: sql<Date | null>`min(${payments.paidAt})`
          .mapWith((value) => (value === null ? null : new Date(value)))
          .as("paid_at"),
      })
      .from(payments)
      .where(inArray(payments.status, ["SUCCEEDED", "REFUND_PENDING", "REFUNDED"]))
      .groupBy(payments.bookingId)
      .as("booking_payments");

    const rows = await this.db
      .select({
        booking: {
          ...getTableColumns(bookings),
          contactName: sql<string>`${bookings.contactName}`,
          contactEmail: sql<string>`${bookings.contactEmail}`,
          contactPhone: sql<string>`${bookings.contactPhone}`,
        },
        checkInSlotStart: slotStart,
        checkInSlotEnd: slotEnd,
        paidAt: paidPayments.paidAt,
        facility: facilities,
        unitType: unitTypes,
        assignment: unitAssignments,
        assignedUnit: storageUnits,
        assigner: users,
        assignedStaff: assignedStaffUsers,
      })
      .from(bookings)
      .innerJoin(checkInSlots, eq(bookings.checkInSlotId, checkInSlots.id))
      .leftJoin(paidPayments, eq(paidPayments.bookingId, bookings.id))
      .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
      .innerJoin(unitTypes, eq(bookings.unitTypeId, unitTypes.id))
      .leftJoin(
        unitAssignments,
        and(eq(unitAssignments.bookingId, bookings.id), eq(unitAssignments.status, "ACTIVE")),
      )
      .leftJoin(storageUnits, eq(unitAssignments.physicalUnitId, storageUnits.id))
      .leftJoin(users, eq(unitAssignments.assignedBy, users.id))
      .leftJoin(assignedStaffUsers, eq(bookings.assignedStaffId, assignedStaffUsers.id))
      .where(and(...conditions))
      .orderBy(slotStart);

    return rows.map(
      ({
        booking,
        checkInSlotStart,
        checkInSlotEnd,
        paidAt,
        facility,
        unitType,
        assignment,
        assignedUnit,
        assigner,
        assignedStaff,
      }) => {
        let activeAssignment: PhysicalUnitAssignment | null = null;
        if (assignment && assignedUnit) {
          activeAssignment = {
            id: assignment.id,
            bookingId: assignment.bookingId,
            physicalUnitId: assignment.physicalUnitId,
            physicalUnitCode: assignedUnit.code,
            assignedBy: assignment.assignedBy,
            assignerName: assigner?.name ?? undefined,
            status: assignment.status as "ACTIVE" | "REASSIGNED" | "CANCELLED",
            assignedAt: assignment.assignedAt.toISOString(),
            endedAt: assignment.endedAt?.toISOString() ?? null,
            reason: assignment.reason ?? null,
          };
        }

        let staffMember: FacilityStaffMember | null = null;
        if (assignedStaff) {
          staffMember = {
            id: assignedStaff.id,
            name: assignedStaff.name,
            email: assignedStaff.email,
            phone: assignedStaff.phone ?? null,
            role: UserRole.FACILITY_STAFF,
            isActive: assignedStaff.status === "ACTIVE",
          };
        }

        return {
          id: booking.id,
          bookingCode: booking.bookingCode ?? booking.id.slice(0, 8).toUpperCase(),
          facilityId: booking.facilityId,
          facilityName: facility.name,
          unitTypeId: booking.unitTypeId,
          unitTypeName: unitType.name,
          unitTypeSizeLabel: unitType.sizeLabel,
          contactName: booking.contactName,
          contactEmail: booking.contactEmail,
          contactPhone: booking.contactPhone,
          checkInSlotStart: checkInSlotStart.toISOString(),
          checkInSlotEnd: checkInSlotEnd?.toISOString() ?? null,
          rentalEndAt: booking.rentalEndAt.toISOString(),
          requestedMonths: booking.requestedMonths,
          totalAmount: Number(booking.totalAmount),
          status: booking.status as "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "CHECKED_IN",
          paidAt: paidAt?.toISOString() ?? null,
          assignedUnit: activeAssignment,
          assignedStaff: staffMember,
          createdAt: booking.createdAt.toISOString(),
        };
      },
    );
  }

  async findEligibleUnits(
    facilityId: string,
    unitTypeId: string,
    currentBookingId: string,
    checkInStart: Date,
    rentalEnd: Date,
  ): Promise<EligibleUnit[]> {
    const slotStart = sql<Date>`(${bookings.checkInDate} + ${checkInSlots.startTime})
      at time zone 'Asia/Ho_Chi_Minh'`.mapWith((value) => new Date(value));

    // 1. Get all units matching facility and unit type
    const allUnits = await this.db
      .select()
      .from(storageUnits)
      .where(
        and(
          eq(storageUnits.facilityId, facilityId),
          eq(storageUnits.unitTypeId, unitTypeId),
          notInArray(storageUnits.status, ["INACTIVE", "LOCKED", "MAINTENANCE", "INSPECTION"]),
        ),
      );

    if (allUnits.length === 0) return [];

    const unitIds = allUnits.map((u) => u.id);

    // 2. Find units with overlapping active rentals
    const conflictingRentals = await this.db
      .select({ physicalUnitId: rentals.physicalUnitId })
      .from(rentals)
      .where(
        and(
          inArray(rentals.physicalUnitId, unitIds),
          eq(rentals.status, "ACTIVE"),
          gt(rentals.expectedEndAt, checkInStart),
        ),
      );
    const conflictingRentalUnitIds = new Set(conflictingRentals.map((r) => r.physicalUnitId));

    // 3. Find units with overlapping active booking assignments (excluding current booking)
    const conflictingAssignments = await this.db
      .select({ physicalUnitId: unitAssignments.physicalUnitId })
      .from(unitAssignments)
      .innerJoin(bookings, eq(unitAssignments.bookingId, bookings.id))
      .innerJoin(checkInSlots, eq(bookings.checkInSlotId, checkInSlots.id))
      .where(
        and(
          inArray(unitAssignments.physicalUnitId, unitIds),
          eq(unitAssignments.status, "ACTIVE"),
          ne(bookings.id, currentBookingId),
          notInArray(bookings.status, ["CANCELLED", "NO_SHOW"]),
          lt(slotStart, rentalEnd.toISOString()),
          gt(bookings.rentalEndAt, checkInStart),
        ),
      );
    const conflictingAssignmentUnitIds = new Set(
      conflictingAssignments.map((a) => a.physicalUnitId),
    );

    return allUnits.map((unit) => {
      const isConflicted =
        conflictingRentalUnitIds.has(unit.id) || conflictingAssignmentUnitIds.has(unit.id);
      return {
        id: unit.id,
        facilityId: unit.facilityId,
        unitTypeId: unit.unitTypeId,
        code: unit.code,
        status: unit.status,
        isAvailableForPeriod: !isConflicted,
      };
    });
  }

  async assignPhysicalUnit(
    bookingId: string,
    physicalUnitId: string,
    assignedByUserId: string,
    reason?: string,
  ) {
    const slotStart = sql<Date>`(${bookings.checkInDate} + ${checkInSlots.startTime})
      at time zone 'Asia/Ho_Chi_Minh'`.mapWith((value) => new Date(value));

    return this.db.transaction(async (tx) => {
      // 1. Lock and fetch the booking
      const [booking] = await tx
        .select({ ...getTableColumns(bookings), checkInSlotStart: slotStart })
        .from(bookings)
        .innerJoin(checkInSlots, eq(bookings.checkInSlotId, checkInSlots.id))
        .where(eq(bookings.id, bookingId))
        .for("update", { of: bookings });

      if (!booking) {
        return { error: "BOOKING_NOT_FOUND" as const };
      }

      if (booking.status !== "CONFIRMED") {
        return { error: "INVALID_BOOKING_STATUS" as const, currentStatus: booking.status };
      }

      // 2. Lock and fetch the physical unit
      const [unit] = await tx
        .select()
        .from(storageUnits)
        .where(eq(storageUnits.id, physicalUnitId))
        .for("update");

      if (!unit) {
        return { error: "PHYSICAL_UNIT_NOT_FOUND" as const };
      }

      // 3. Check facility and unit type match
      if (unit.facilityId !== booking.facilityId || unit.unitTypeId !== booking.unitTypeId) {
        return { error: "UNIT_TYPE_OR_FACILITY_MISMATCH" as const };
      }

      // 4. Check physical unit status
      if (["INACTIVE", "LOCKED", "MAINTENANCE", "INSPECTION"].includes(unit.status)) {
        return { error: "UNIT_STATUS_INVALID" as const, unitStatus: unit.status };
      }

      // 5. Revalidate overlapping active rentals
      const [activeRental] = await tx
        .select({ id: rentals.id })
        .from(rentals)
        .where(
          and(
            eq(rentals.physicalUnitId, unit.id),
            eq(rentals.status, "ACTIVE"),
            gt(rentals.expectedEndAt, booking.checkInSlotStart),
          ),
        )
        .for("update");

      if (activeRental) {
        return { error: "UNIT_RENTAL_CONFLICT" as const };
      }

      // 6. Revalidate overlapping active booking assignments
      const [conflictingBooking] = await tx
        .select({ id: bookings.id })
        .from(unitAssignments)
        .innerJoin(bookings, eq(unitAssignments.bookingId, bookings.id))
        .innerJoin(checkInSlots, eq(bookings.checkInSlotId, checkInSlots.id))
        .where(
          and(
            eq(unitAssignments.physicalUnitId, unit.id),
            eq(unitAssignments.status, "ACTIVE"),
            ne(bookings.id, booking.id),
            notInArray(bookings.status, ["CANCELLED", "NO_SHOW"]),
            lt(slotStart, booking.rentalEndAt.toISOString()),
            gt(bookings.rentalEndAt, booking.checkInSlotStart),
          ),
        )
        .for("update", { of: [unitAssignments, bookings] });

      if (conflictingBooking) {
        return { error: "UNIT_ASSIGNMENT_CONFLICT" as const };
      }

      const now = new Date();

      // 7. Deactivate any existing active assignment for this booking
      await tx
        .update(unitAssignments)
        .set({ status: "REASSIGNED", endedAt: now })
        .where(
          and(eq(unitAssignments.bookingId, booking.id), eq(unitAssignments.status, "ACTIVE")),
        );

      // 8. Create new active assignment
      const [newAssignment] = await tx
        .insert(unitAssignments)
        .values({
          bookingId: booking.id,
          physicalUnitId: unit.id,
          assignedBy: assignedByUserId,
          status: "ACTIVE",
          assignedAt: now,
          reason: reason ?? null,
        })
        .returning();

      if (!newAssignment) {
        throw new Error(BOOKING_MESSAGES.failedToCreateUnitAssignment);
      }

      return {
        success: true as const,
        assignment: {
          id: newAssignment.id,
          bookingId: newAssignment.bookingId,
          physicalUnitId: newAssignment.physicalUnitId,
          physicalUnitCode: unit.code,
          assignedBy: newAssignment.assignedBy,
          status: "ACTIVE" as const,
          assignedAt: newAssignment.assignedAt.toISOString(),
          endedAt: null,
          reason: newAssignment.reason ?? null,
        },
      };
    });
  }

  async handoverProgress(bookingIds: string[]) {
    if (!bookingIds.length) return [];
    return this.db
      .select({
        bookingId: handoverInspections.bookingId,
        status: handoverInspections.status,
        handedOverAt: handoverInspections.handedOverAt,
      })
      .from(handoverInspections)
      .innerJoin(bookings, eq(bookings.id, handoverInspections.bookingId))
      .innerJoin(
        unitAssignments,
        and(
          eq(unitAssignments.id, handoverInspections.unitAssignmentId),
          eq(unitAssignments.status, "ACTIVE"),
        ),
      )
      .innerJoin(
        checkInVerifications,
        and(
          eq(checkInVerifications.id, handoverInspections.verificationId),
          inArray(checkInVerifications.status, ["VERIFIED", "CONSUMED"]),
          eq(checkInVerifications.staffId, bookings.assignedStaffId),
        ),
      )
      .where(inArray(handoverInspections.bookingId, bookingIds))
      .orderBy(desc(handoverInspections.updatedAt));
  }

  async assignStaff(bookingId: string, staffId: string) {
    return this.db.transaction(async (tx) => {
      // 1. Lock and fetch booking
      const [booking] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .for("update");

      if (!booking) {
        return { error: "BOOKING_NOT_FOUND" as const };
      }

      if (booking.status !== "CONFIRMED") return { error: "INVALID_BOOKING_STATUS" as const };

      // 2. Verify staff member exists and has active FACILITY_STAFF assignment for this facility
      const [staff] = await tx
        .select({
          user: users,
          assignment: facilityAssignments,
        })
        .from(users)
        .innerJoin(facilityAssignments, eq(users.id, facilityAssignments.userId))
        .where(
          and(
            eq(users.id, staffId),
            eq(users.role, "FACILITY_STAFF"),
            eq(facilityAssignments.facilityId, booking.facilityId),
            eq(facilityAssignments.role, "FACILITY_STAFF"),
            eq(facilityAssignments.isActive, true),
          ),
        );

      if (!staff) {
        return { error: "STAFF_NOT_IN_FACILITY" as const };
      }

      if (staff.user.status !== "ACTIVE") {
        return { error: "STAFF_INACTIVE" as const };
      }

      if (booking.assignedStaffId !== staffId) {
        await tx
          .update(checkInVerifications)
          .set({
            status: "INVALIDATED",
            invalidatedAt: new Date(),
            invalidatedReason: "Staff assignment changed",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(checkInVerifications.bookingId, bookingId),
              eq(checkInVerifications.status, "VERIFIED"),
            ),
          );
      }
      // 3. Update booking assignedStaffId
      await tx
        .update(bookings)
        .set({ assignedStaffId: staffId, updatedAt: new Date() })
        .where(and(eq(bookings.id, bookingId), ne(bookings.status, "DRAFT")));

      return { success: true as const, bookingId, staffId };
    });
  }
}

// Caller supplies a transaction. Booking is always locked before payment, matching
// checkout, verification and handover so only one lifecycle transition can win.
export async function closeBookingBeforeCheckIn(
  tx: BookingTransaction,
  bookingId: string,
  target: "CANCELLED" | "NO_SHOW",
  now: Date,
): Promise<BookingClosure | null> {
  const [booking] = await tx
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .for("update");
  if (!booking) return null;
  if (target === "CANCELLED" && booking.status === "CANCELLED") {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.bookingId, bookingId),
          eq(payments.refundReason, "CUSTOMER_CANCELLATION"),
          inArray(payments.status, ["REFUND_PENDING", "REFUNDED"]),
        ),
      )
      .for("update");
    if (!payment) throw new AppError(BOOKING_MESSAGES.cancellationPaymentInvalid, 409);
    return {
      bookingId,
      status: "CANCELLED",
      payment: {
        paymentId: payment.id,
        status: payment.status as "REFUND_PENDING" | "REFUNDED",
        refundAmount: payment.refundAmount ?? payment.totalAmount,
        depositForfeitedAmount: payment.depositForfeitedAmount,
        currency: payment.currency,
      },
    };
  }
  if (booking.status !== "CONFIRMED") return null;
  const dayEnd = await new CheckInSlotsRepository(tx).findDayEnd(booking.checkInDate);
  if (!dayEnd || (target === "NO_SHOW" ? now < dayEnd : now >= dayEnd)) return null;
  const [rental] = await tx
    .select({ id: rentals.id })
    .from(rentals)
    .where(eq(rentals.bookingId, bookingId))
    .limit(1);
  if (rental) return null;
  const [payment] = await tx
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.bookingId, bookingId),
        eq(payments.status, "SUCCEEDED"),
        isNotNull(payments.paidAt),
        eq(payments.totalAmount, booking.totalAmount),
        sql`${payments.totalAmount} = ${booking.rentalFeeAmount}::numeric + ${booking.depositAmount}::numeric`,
      ),
    )
    .for("update");
  if (!payment) throw new AppError(BOOKING_MESSAGES.cancellationPaymentInvalid, 409);
  const reason =
    target === "CANCELLED" ? BOOKING_MESSAGES.cancellationReason : BOOKING_MESSAGES.noShowReason;
  await tx
    .update(payments)
    .set({
      status: "REFUND_PENDING",
      refundAmount: booking.rentalFeeAmount,
      depositForfeitedAmount: booking.depositAmount,
      refundReason: target === "CANCELLED" ? "CUSTOMER_CANCELLATION" : "NO_SHOW",
      updatedAt: now,
    })
    .where(eq(payments.id, payment.id));
  await tx
    .update(capacityAllocations)
    .set({ status: "RELEASED", updatedAt: now })
    .where(
      and(
        eq(capacityAllocations.referenceId, bookingId),
        eq(capacityAllocations.kind, "BOOKING"),
        eq(capacityAllocations.status, "ACTIVE"),
      ),
    );
  await tx
    .update(checkInVerifications)
    .set({ status: "INVALIDATED", invalidatedAt: now, invalidatedReason: reason, updatedAt: now })
    .where(
      and(
        eq(checkInVerifications.bookingId, bookingId),
        eq(checkInVerifications.status, "VERIFIED"),
      ),
    );
  await tx
    .update(unitAssignments)
    .set({ status: "CANCELLED", endedAt: now, reason })
    .where(and(eq(unitAssignments.bookingId, bookingId), eq(unitAssignments.status, "ACTIVE")));
  await tx
    .update(bookings)
    .set({ status: target, assignedStaffId: null, updatedAt: now })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, "CONFIRMED")));
  return {
    bookingId,
    status: target,
    payment: {
      paymentId: payment.id,
      status: "REFUND_PENDING",
      refundAmount: booking.rentalFeeAmount,
      depositForfeitedAmount: booking.depositAmount,
      currency: payment.currency,
    },
  };
}
