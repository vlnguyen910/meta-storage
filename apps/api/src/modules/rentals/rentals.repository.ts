import type { RentalDetail, RentalListItem } from "@metastorage/contracts";
import {
  and,
  bookings,
  type Database,
  eq,
  facilities,
  rentals,
  storageUnits,
  unitTypes,
} from "@metastorage/database";

import { bookingReadFields } from "../bookings/bookings.projection";
import type { BookingReadRecord } from "../bookings/bookings.types";

const ACTIONS = {
  canCancel: false as const,
  canReschedule: false as const,
  note: "Các thao tác hủy, đổi lịch và yêu cầu hoàn tiền sẽ được bổ sung ở phiên bản sau.",
};

export class RentalsRepository {
  constructor(private readonly db: Database) {}

  private baseQuery() {
    return this.db
      .select({
        rental: rentals,
        booking: bookingReadFields,
        facility: facilities,
        unitType: unitTypes,
        physicalUnit: storageUnits,
      })
      .from(rentals)
      .innerJoin(bookings, eq(bookings.id, rentals.bookingId))
      .innerJoin(facilities, eq(facilities.id, rentals.facilityId))
      .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
      .leftJoin(storageUnits, eq(storageUnits.id, rentals.physicalUnitId));
  }

  async listByUserId(userId: string): Promise<RentalListItem[]> {
    const rows = await this.baseQuery().where(eq(bookings.userId, userId));
    return rows.map(toListItem);
  }

  async findByIdAndUserId(rentalId: string, userId: string): Promise<RentalDetail | null> {
    const [row] = await this.baseQuery().where(
      and(eq(rentals.id, rentalId), eq(bookings.userId, userId)),
    );
    return row ? toDetail(row) : null;
  }
}

type RentalRow = Awaited<ReturnType<RentalsRepository["listByUserId"]>>[number] extends never
  ? never
  : {
      rental: typeof rentals.$inferSelect;
      booking: BookingReadRecord;
      facility: typeof facilities.$inferSelect;
      unitType: typeof unitTypes.$inferSelect;
      physicalUnit: typeof storageUnits.$inferSelect | null;
    };

function toListItem(row: RentalRow): RentalListItem {
  return {
    id: row.rental.id,
    bookingId: row.booking.id,
    bookingCode: row.booking.bookingCode ?? row.booking.id.slice(0, 8).toUpperCase(),
    facility: { id: row.facility.id, name: row.facility.name, address: row.facility.address },
    unitType: { id: row.unitType.id, name: row.unitType.name, sizeLabel: row.unitType.sizeLabel },
    physicalUnit: row.physicalUnit
      ? { id: row.physicalUnit.id, code: row.physicalUnit.code }
      : null,
    startAt: row.rental.startAt.toISOString(),
    expectedEndAt: row.rental.expectedEndAt.toISOString(),
    status: row.rental.status,
    bookingStatus: row.booking.status,
    actions: ACTIONS,
  };
}

function toDetail(row: RentalRow): RentalDetail {
  const item = toListItem(row);
  return {
    ...item,
    actualReturnAt: row.rental.actualReturnAt?.toISOString() ?? null,
    closedAt: row.rental.closedAt?.toISOString() ?? null,
    depositAmount: row.rental.depositAmount,
    checkInSlotStart: row.booking.checkInSlotStart.toISOString(),
    checkInSlotEnd: row.booking.checkInSlotEnd?.toISOString() ?? null,
    timeline: [
      { label: "Booking confirmed", status: "DONE", at: row.booking.paidAt?.toISOString() ?? null },
      {
        label: "Check-in",
        status: row.rental.status === "ACTIVE" ? "CURRENT" : "DONE",
        at: row.booking.checkInSlotStart.toISOString(),
      },
      {
        label: "Return",
        status: row.rental.closedAt ? "DONE" : "UPCOMING",
        at: row.rental.expectedEndAt.toISOString(),
      },
    ],
  };
}
