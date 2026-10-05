import { bookings, checkInSlots, getTableColumns, payments, sql } from "@metastorage/database";

// Keep legacy API timestamps while the database stores a local date and a slot.
export const bookingCheckInSlotStart = sql<Date>`(
  ${bookings.checkInDate} + (
    select ${checkInSlots.startTime} from ${checkInSlots}
    where ${checkInSlots.id} = ${bookings.checkInSlotId}
  )
) at time zone 'Asia/Ho_Chi_Minh'`.mapWith((value) => new Date(value));

export const bookingCheckInSlotEnd = sql<Date>`(
  ${bookings.checkInDate} + (
    select ${checkInSlots.endTime} from ${checkInSlots}
    where ${checkInSlots.id} = ${bookings.checkInSlotId}
  )
) at time zone 'Asia/Ho_Chi_Minh'`.mapWith((value) => new Date(value));

// Qualify the outer ID explicitly: single-table projections otherwise strip the table
// qualifier, making the subquery compare payments.booking_id with payments.id.
export const bookingPaidAt = sql<Date | null>`(
  select min(${payments.paidAt}) from ${payments}
  where ${payments.bookingId} = ${sql.raw('"bookings"."id"')}
    and ${payments.status} in ('SUCCEEDED', 'REFUNDED')
)`.mapWith((value) => (value === null ? null : new Date(value)));

// Operational readers exclude DRAFT; the database requires complete contact after DRAFT.
export const bookingReadFields = {
  ...getTableColumns(bookings),
  contactName: sql<string>`${bookings.contactName}`,
  contactEmail: sql<string>`${bookings.contactEmail}`,
  contactPhone: sql<string>`${bookings.contactPhone}`,
  checkInSlotStart: bookingCheckInSlotStart,
  checkInSlotEnd: bookingCheckInSlotEnd,
  paidAt: bookingPaidAt,
};
