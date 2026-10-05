import {
  type BookingListItem,
  type EligibleUnit,
  type FacilityStaffMember,
  type PhysicalUnitAssignment,
  UserRole,
} from "@metastorage/contracts";
import {
  aliasedTable,
  and,
  bookings,
  checkInSlots,
  checkInVerifications,
  type Database,
  desc,
  eq,
  facilities,
  facilityAssignments,
  getTableColumns,
  gt,
  handoverInspections,
  inArray,
  lt,
  type NewBooking,
  ne,
  notInArray,
  payments,
  rentals,
  sql,
  storageUnits,
  unitAssignments,
  unitTypes,
  users,
} from "@metastorage/database";
import { BOOKING_MESSAGES } from "./bookings.messages";

const assignedStaffUsers = aliasedTable(users, "assigned_staff_users");

export class BookingsRepository {
  constructor(private readonly db: Database) {}

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
      .where(inArray(payments.status, ["SUCCEEDED", "REFUNDED"]))
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
      .where(inArray(payments.status, ["SUCCEEDED", "REFUNDED"]))
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
      .where(inArray(payments.status, ["SUCCEEDED", "REFUNDED"]))
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
