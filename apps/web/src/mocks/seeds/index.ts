import { StorageUnitStatus } from "@metastorage/contracts";
import type { MockDatabase } from "../types";
import { bookingSeeds } from "./bookings.seed";
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
  for (const booking of [bookings[0], bookings[2]]) {
    if (!booking) continue;
    booking.checkInSlotStart = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    booking.checkInSlotEnd = new Date(Date.now() + 90 * 60 * 1000).toISOString();
  }
  return {
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
}
