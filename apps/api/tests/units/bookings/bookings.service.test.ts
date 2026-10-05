import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type BookingListItem, type FacilityStaffMember, UserRole } from "@metastorage/contracts";
import type { BookingsRepository } from "../../../src/modules/bookings/bookings.repository";
import { BookingsService } from "../../../src/modules/bookings/bookings.service";

const facilityId = "11111111-1111-1111-1111-111111111111";
const unitTypeId = "22222222-2222-2222-2222-222222222222";
const bookingId = "33333333-3333-3333-3333-333333333333";
const physicalUnitId = "44444444-4444-4444-4444-444444444444";
const userId = "55555555-5555-5555-5555-555555555555";
const staffId = "88888888-8888-8888-8888-888888888888";

const mockStaffMember: FacilityStaffMember = {
  id: staffId,
  name: "Tran Quoc Huy",
  email: "staff@metastorage.test",
  phone: "0900000002",
  role: UserRole.FACILITY_STAFF,
  isActive: true,
};

function mockBooking(overrides: Partial<BookingListItem> = {}): BookingListItem {
  return {
    id: bookingId,
    bookingCode: "BK-2026-0001",
    facilityId,
    facilityName: "METASTORAGE Cau Giay",
    unitTypeId,
    unitTypeName: "Small Storage (1.5m²)",
    unitTypeSizeLabel: "Small",
    contactName: "Le Thi Khach Hang",
    contactEmail: "customer@example.com",
    contactPhone: "+84912345678",
    checkInSlotStart: new Date(Date.now() + 86400000).toISOString(),
    checkInSlotEnd: new Date(Date.now() + 93600000).toISOString(),
    rentalEndAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    requestedMonths: 1,
    totalAmount: 1600000,
    status: "CONFIRMED",
    paidAt: new Date().toISOString(),
    assignedUnit: null,
    assignedStaff: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function mockRepository(overrides: Partial<BookingsRepository> = {}): BookingsRepository {
  return {
    findFacilityBookings: async () => [mockBooking()],
    findBookingById: async () => mockBooking(),
    findByQrToken: async () => ({
      bookingId,
      bookingCode: "BK-2026-0001",
      status: "CONFIRMED" as const,
      facilityId,
      unitTypeId,
      checkInSlotStart: new Date(Date.now() + 86400000).toISOString(),
      rentalEndAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    }),
    findEligibleUnits: async () => [
      {
        id: physicalUnitId,
        facilityId,
        unitTypeId,
        code: "HN-S-101",
        status: "AVAILABLE",
        isAvailableForPeriod: true,
      },
    ],
    assignPhysicalUnit: async () => ({
      success: true,
      assignment: {
        id: "77777777-7777-7777-7777-777777777777",
        bookingId,
        physicalUnitId,
        physicalUnitCode: "HN-S-101",
        assignedBy: userId,
        status: "ACTIVE",
        assignedAt: new Date().toISOString(),
        endedAt: null,
        reason: "Khách yêu cầu ô kho tầng trệt",
      },
    }),
    findFacilityStaff: async () => [mockStaffMember],
    assignStaff: async () => ({ success: true, bookingId, staffId }),
    handoverProgress: async () => [],
    findStaffTasks: async () => [mockBooking({ assignedStaff: mockStaffMember })],
    ...overrides,
  } as unknown as BookingsRepository;
}

function bookingsService(repository: BookingsRepository) {
  return new BookingsService(
    repository,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
  );
}

describe("BookingsService - Physical Unit Assignment", () => {
  it("retrieves paid bookings within FM's facility scope", async () => {
    const service = bookingsService(mockRepository());
    const result = await service.getFacilityBookings(facilityId);

    assert.equal(result.length, 1);
    assert.equal(result[0].bookingCode, "BK-2026-0001");
    assert.equal(result[0].status, "CONFIRMED");
  });

  it("lists eligible physical units matching facility and unit type", async () => {
    const service = bookingsService(mockRepository());
    const units = await service.getEligibleUnits(bookingId);

    assert.equal(units.length, 1);
    assert.equal(units[0].code, "HN-S-101");
    assert.equal(units[0].isAvailableForPeriod, true);
  });

  it("successfully assigns an eligible physical unit to a confirmed booking", async () => {
    const service = bookingsService(mockRepository());
    const assignment = await service.assignPhysicalUnit(
      bookingId,
      physicalUnitId,
      userId,
      "Khách yêu cầu ô kho tầng trệt",
    );

    assert.equal(assignment.physicalUnitCode, "HN-S-101");
    assert.equal(assignment.status, "ACTIVE");
    assert.equal(assignment.assignedBy, userId);
  });

  it("throws NotFoundError when booking does not exist", async () => {
    const service = bookingsService(
      mockRepository({
        assignPhysicalUnit: async () => ({ error: "BOOKING_NOT_FOUND" }),
      }),
    );

    await assert.rejects(() => service.assignPhysicalUnit(bookingId, physicalUnitId, userId), {
      name: "NotFoundError",
    });
  });

  it("rejects assignment if booking status is not CONFIRMED (e.g. CANCELLED or NO_SHOW)", async () => {
    const service = bookingsService(
      mockRepository({
        assignPhysicalUnit: async () => ({
          error: "INVALID_BOOKING_STATUS",
          currentStatus: "CANCELLED",
        }),
      }),
    );

    await assert.rejects(() => service.assignPhysicalUnit(bookingId, physicalUnitId, userId), {
      name: "BadRequestError",
    });
  });

  it("rejects assignment if unit belongs to different facility or unit type", async () => {
    const service = bookingsService(
      mockRepository({
        assignPhysicalUnit: async () => ({
          error: "UNIT_TYPE_OR_FACILITY_MISMATCH",
        }),
      }),
    );

    await assert.rejects(() => service.assignPhysicalUnit(bookingId, physicalUnitId, userId), {
      name: "ValidationError",
    });
  });

  it("rejects assignment if unit is in MAINTENANCE or INSPECTION", async () => {
    const service = bookingsService(
      mockRepository({
        assignPhysicalUnit: async () => ({
          error: "UNIT_STATUS_INVALID",
          unitStatus: "MAINTENANCE",
        }),
      }),
    );

    await assert.rejects(() => service.assignPhysicalUnit(bookingId, physicalUnitId, userId), {
      name: "BadRequestError",
    });
  });

  it("rejects assignment if unit has active rental conflict", async () => {
    const service = bookingsService(
      mockRepository({
        assignPhysicalUnit: async () => ({
          error: "UNIT_RENTAL_CONFLICT",
        }),
      }),
    );

    await assert.rejects(() => service.assignPhysicalUnit(bookingId, physicalUnitId, userId), {
      name: "ConflictError",
    });
  });

  it("rejects assignment if unit has overlapping active assignment to another booking", async () => {
    const service = bookingsService(
      mockRepository({
        assignPhysicalUnit: async () => ({
          error: "UNIT_ASSIGNMENT_CONFLICT",
        }),
      }),
    );

    await assert.rejects(() => service.assignPhysicalUnit(bookingId, physicalUnitId, userId), {
      name: "ConflictError",
    });
  });
});

describe("BookingsService - Facility Staff Assignment", () => {
  it("successfully assigns an eligible staff member to a booking", async () => {
    const service = bookingsService(
      mockRepository({
        findBookingById: async () => mockBooking({ assignedStaff: mockStaffMember }),
      }),
    );
    const updated = await service.assignStaff(bookingId, staffId);

    assert.equal(updated.assignedStaff?.id, staffId);
    assert.equal(updated.assignedStaff?.name, "Tran Quoc Huy");
  });

  it("rejects staff assignment if booking does not exist", async () => {
    const service = bookingsService(
      mockRepository({
        assignStaff: async () => ({ error: "BOOKING_NOT_FOUND" }),
      }),
    );

    await assert.rejects(() => service.assignStaff(bookingId, staffId), {
      name: "NotFoundError",
    });
  });

  it("rejects staff assignment if staff does not belong to the facility scope", async () => {
    const service = bookingsService(
      mockRepository({
        assignStaff: async () => ({ error: "STAFF_NOT_IN_FACILITY" }),
      }),
    );

    await assert.rejects(() => service.assignStaff(bookingId, staffId), {
      name: "BadRequestError",
    });
  });

  it("rejects staff assignment if staff user is inactive", async () => {
    const service = bookingsService(
      mockRepository({
        assignStaff: async () => ({ error: "STAFF_INACTIVE" }),
      }),
    );

    await assert.rejects(() => service.assignStaff(bookingId, staffId), {
      name: "BadRequestError",
    });
  });

  it("retrieves tasks assigned to a specific staff member", async () => {
    const service = bookingsService(mockRepository());
    const tasks = await service.getStaffTasks(staffId, facilityId);

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].assignedStaff?.id, staffId);
  });
});
