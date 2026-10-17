import { bookings, checkInSlots, db, eq, isNull, queryClient } from "@metastorage/database";

// Slot endpoints now come from check_in_slots; never invent appointment times.
try {
  const missing = await db
    .select({
      bookingId: bookings.id,
      bookingCode: bookings.bookingCode,
      checkInDate: bookings.checkInDate,
      checkInSlotId: bookings.checkInSlotId,
    })
    .from(bookings)
    .leftJoin(checkInSlots, eq(checkInSlots.id, bookings.checkInSlotId))
    .where(isNull(checkInSlots.id));
  console.log(JSON.stringify({ mode: "audit", count: missing.length, missing }, null, 2));
  if (process.argv.includes("--apply") && missing.length) {
    throw new Error(
      "Bookings require a valid facility check-in slot. Apply the check-in-slot migrations and review missing appointments; automatic time replacement is disabled.",
    );
  }
} finally {
  await queryClient.end();
}
