import { StorageUnitStatus } from "@metastorage/contracts";
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
    verifications: [],
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
  };
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
