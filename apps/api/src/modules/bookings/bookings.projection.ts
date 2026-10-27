import {
  alias,
  bookings,
  checkInSlots,
  getTableColumns,
  payments,
  sql,
  users,
} from "@metastorage/database";

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
    and ${payments.status} in ('SUCCEEDED', 'REFUND_PENDING', 'REFUNDED')
)`.mapWith((value) => (value === null ? null : new Date(value)));

export const bookingCustomer = alias(users, "booking_customer");

// Operational readers join the required account; phone belongs to the booking.
export const bookingReadFields = {
  ...getTableColumns(bookings),
  contactName: bookingCustomer.name,
  contactEmail: bookingCustomer.email,
  contactPhone: sql<string>`${bookings.contactPhone}`,
  checkInSlotStart: bookingCheckInSlotStart,
  checkInSlotEnd: bookingCheckInSlotEnd,
  paidAt: bookingPaidAt,
};
