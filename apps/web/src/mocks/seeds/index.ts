import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  type AppointmentRecordDto,
  type RentalDetail,
  StorageUnitStatus,
} from "@metastorage/contracts";
import type { MockDatabase } from "../types";
import { bookingSeeds, mockStaffHuy } from "./bookings.seed";
import { facilitySeeds } from "./facilities.seed";
import { storageUnitSeeds } from "./storage-units.seed";
import { userSeeds } from "./users.seed";

export { bookingSeeds } from "./bookings.seed";
export { demoAccounts } from "./users.seed";

export function createSeedDatabase(): MockDatabase {
  const units = structuredClone(storageUnitSeeds);
  for (let i = 0; i < 10; i++) {
    const template = units[i % 8];
    if (template)
      units.push({
        ...template,
        id: `hcm-01-unit-${i + 9}`,
        code: `HCM-01-${String(i + 9).padStart(3, "0")}`,
        status: StorageUnitStatus.AVAILABLE,
      });
  }
  const bookings = structuredClone(bookingSeeds);
  const facility = facilitySeeds[0];
  const customer = userSeeds[0];
  const demoRental: RentalDetail = {
    id: "c0000000-0000-0000-0000-000000000001",
    bookingId: "b0000000-0000-0000-0000-000000000001",
    reservationId: "a0000000-0000-0000-0000-000000000001",
    userId: customer?.id ?? "user-1",
    bookingCode: "BK-2026-RETURN-DEMO",
    facility: {
      id: facility?.id ?? "fac-hcm-central",
      name: facility?.name ?? "metastorage Sài Gòn Central",
      address: facility
        ? `${facility.address.line1}, ${facility.address.ward}, ${facility.address.district}, ${facility.address.city}`
        : "118 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh",
    },
    unitType: {
      id: "00000000-0000-0000-0001-000000000001",
      name: "Kho tiêu chuẩn",
      sizeLabel: "2 m²",
    },
    storageUnit: { id: "hcm-01-unit-9", code: "HCM-01-009" },
    startAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    endAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    closedAt: null,
    status: "ACTIVE",
    bookingStatus: "CHECKED_IN",
    actions: { canCancel: false, canReschedule: false, note: "" },
    customer: {
      userId: customer?.id ?? "user-1",
      name: customer?.name ?? "Nguyễn Minh Anh",
      email: customer?.email ?? "customer@metastorage.test",
      phone: customer?.phone ?? "0900000001",
    },
  };
  const localDate = (offset: number) => {
    const date = new Date(Date.now() + offset * 86400000);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  };
  const demoAppointments: AppointmentRecordDto[] = [
    {
      id: "d0000000-0000-0000-0000-000000000001",
      facilityId: demoRental.facility.id,
      appointmentType: APPOINTMENT_TYPES.CHECK_IN,
      scheduledDate: localDate(1),
      slotId: "e0000000-0000-0000-0000-000000000001",
      status: APPOINTMENT_STATUSES.CONFIRMED,
      customerId: demoRental.userId,
      contactPhone: demoRental.customer.phone,
      reservationId: demoRental.reservationId ?? null,
      rentalId: null,
      supportTicketId: null,
      assignedStaffId: null,
      createdBy: demoRental.userId,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slotName: "Ca nhận kho",
      slotStart: "09:00:00",
      slotEnd: "10:00:00",
      facility: {
        id: demoRental.facility.id,
        name: demoRental.facility.name,
        address: demoRental.facility.address,
      },
    },
    {
      id: "d0000000-0000-0000-0000-000000000002",
      facilityId: demoRental.facility.id,
      appointmentType: APPOINTMENT_TYPES.CHECK_OUT,
      scheduledDate: localDate(3),
      slotId: "e0000000-0000-0000-0000-000000000002",
      status: APPOINTMENT_STATUSES.CANCELLED,
      customerId: demoRental.userId,
      contactPhone: demoRental.customer.phone,
      reservationId: null,
      rentalId: demoRental.id,
      supportTicketId: null,
      assignedStaffId: null,
      createdBy: demoRental.userId,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slotName: "Ca trả kho",
      slotStart: "14:00:00",
      slotEnd: "15:00:00",
      facility: {
        id: demoRental.facility.id,
        name: demoRental.facility.name,
        address: demoRental.facility.address,
      },
    },
    {
      id: "d0000000-0000-0000-0000-000000000003",
      facilityId: demoRental.facility.id,
      appointmentType: APPOINTMENT_TYPES.SUPPORT,
      scheduledDate: localDate(-1),
      slotId: "e0000000-0000-0000-0000-000000000003",
      status: APPOINTMENT_STATUSES.COMPLETED,
      customerId: demoRental.userId,
      contactPhone: demoRental.customer.phone,
      reservationId: null,
      rentalId: null,
      supportTicketId: "f0000000-0000-0000-0000-000000000001",
      assignedStaffId: null,
      createdBy: demoRental.userId,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slotName: "Hỗ trợ khách hàng",
      slotStart: "10:00:00",
      slotEnd: "10:30:00",
      facility: {
        id: demoRental.facility.id,
        name: demoRental.facility.name,
        address: demoRental.facility.address,
      },
    },
  ];
  for (const booking of bookings) {
    const unit = units.find((u) => u.unitTypeId === booking.unitTypeId);
    if (unit) booking.totalAmount = unit.monthlyPrice * (booking.requestedMonths + 1);
    const assigned = units.find((u) => u.id === booking.assignedUnit?.physicalUnitId);
    if (assigned)
      assigned.status =
        booking.status === "CHECKED_IN" ? StorageUnitStatus.OCCUPIED : StorageUnitStatus.RESERVED;
  }
  const database: MockDatabase = {
    version: 4,
    drafts: [],
    holds: [],
    checkoutResults: [],
    inspections: [],
    photoContents: [],
    rentals: [],
    users: structuredClone(userSeeds),
    facilities: structuredClone(facilitySeeds),
    units,
    quotes: [],
    reservations: [],
    payments: [],
    bookings,
    appointments: demoAppointments,
  };
  if (customer) database.rentals.push({ ...demoRental, userId: customer.id });
  applyDemoBookingSchedule(database);
  return database;
}

export const DEMO_BOOKING_SCHEDULE_REVISION = "2026-10-13-1535-v2";

export function applyDemoBookingSchedule(database: MockDatabase): void {
  const appointments = [
    ["BK-2026-0001", "2026-10-13T15:28:00+07:00"],
    ["BK-2026-0003", "2026-10-13T15:30:00+07:00"],
  ] as const;
  for (const [code, appointment] of appointments) {
    const booking = database.bookings.find((item) => item.bookingCode === code);
    // Historical handovers keep the schedule recorded with their rental.
    if (booking?.status !== "CONFIRMED") continue;
    const start = new Date(appointment);
    const rentalEnd = new Date(start);
    rentalEnd.setUTCMonth(rentalEnd.getUTCMonth() + booking.requestedMonths);
    booking.checkInSlotStart = start.toISOString();
    booking.checkInSlotEnd = new Date(start.getTime() + 2 * 3600000).toISOString();
    booking.rentalEndAt = rentalEnd.toISOString();
  }
  const arrivals = [
    ["0006", "Nguyễn Hoàng Nam", "BK-2026-0001", null],
    ["0007", "Phạm Ngọc Anh", "BK-2026-0002", 19],
    ["0008", "Trần Minh Quân", "BK-2026-0003", 20],
  ] as const;
  for (const [suffix, name, sourceCode, unitNumber] of arrivals) {
    const code = `BK-2026-${suffix}`;
    if (database.bookings.some((booking) => booking.bookingCode === code)) continue;
    const template = bookingSeeds.find((booking) => booking.bookingCode === sourceCode);
    const unitTemplate = database.units.find((unit) => unit.unitTypeId === template?.unitTypeId);
    if (!template || !unitTemplate) continue;
    const booking = structuredClone(template);
    const start = new Date("2026-10-13T15:35:00+07:00");
    const rentalEnd = new Date(start);
    rentalEnd.setUTCMonth(rentalEnd.getUTCMonth() + 1);
    booking.id = `b0000000-0000-0000-0000-00000000${suffix}`;
    booking.bookingCode = code;
    booking.contactName = name;
    booking.contactEmail = `demo${suffix}@example.test`;
    booking.contactPhone = `090123${suffix}`;
    booking.checkInSlotStart = start.toISOString();
    booking.checkInSlotEnd = new Date(start.getTime() + 2 * 3600000).toISOString();
    booking.rentalEndAt = rentalEnd.toISOString();
    booking.requestedMonths = 1;
    booking.totalAmount = unitTemplate.monthlyPrice * 2;
    booking.status = "CONFIRMED";
    booking.paidAt = "2026-10-13T07:00:00.000Z";
    booking.createdAt = "2026-10-13T06:00:00.000Z";
    booking.assignedUnit = null;
    booking.assignedStaff = unitNumber ? structuredClone(mockStaffHuy) : null;
    if (unitNumber) {
      const unitId = `hcm-01-unit-${unitNumber}`;
      let unit = database.units.find((item) => item.id === unitId);
      if (!unit) {
        unit = {
          ...unitTemplate,
          id: unitId,
          code: `HCM-01-${unitNumber.toString().padStart(3, "0")}`,
          status: StorageUnitStatus.AVAILABLE,
        };
        database.units.push(unit);
      }
      if (
        unit.status === StorageUnitStatus.AVAILABLE &&
        unit.unitTypeId === booking.unitTypeId &&
        !database.bookings.some(
          (item) =>
            item.assignedUnit?.physicalUnitId === unitId &&
            ["CONFIRMED", "CHECKED_IN"].includes(item.status),
        )
      ) {
        unit.status = StorageUnitStatus.RESERVED;
        booking.assignedUnit = {
          id: `asgn-${booking.id}`,
          bookingId: booking.id,
          physicalUnitId: unit.id,
          physicalUnitCode: unit.code,
          assignedBy: "user-3",
          assignerName: "Lê Thu Hà",
          status: "ACTIVE",
          assignedAt: "2026-10-13T07:10:00.000Z",
          endedAt: null,
          reason: "Booking demo nhận kho lúc 15:35",
        };
      }
    }
    database.bookings.push(booking);
  }
  database.demoScheduleRevision = DEMO_BOOKING_SCHEDULE_REVISION;
}
