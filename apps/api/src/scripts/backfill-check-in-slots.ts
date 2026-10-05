import { and, bookings, db, eq, isNull, queryClient } from "@metastorage/database";
import { getCheckInSlotEnd } from "../modules/check-ins/check-in-slot";

// Dry-run by default. Only fill missing ends; retain existing appointments and statuses.
const apply = process.argv.includes("--apply");
try {
  const result = await db.transaction(async (tx) => {
    const missing = await tx
      .select({ id: bookings.id, code: bookings.bookingCode, start: bookings.checkInSlotStart })
      .from(bookings)
      .where(isNull(bookings.checkInSlotEnd))
      .for("update");
    const changes = [];
    for (const row of missing) {
      const end = getCheckInSlotEnd(row.start);
      if (apply) {
        await tx
          .update(bookings)
          .set({ checkInSlotEnd: end, updatedAt: new Date() })
          .where(and(eq(bookings.id, row.id), isNull(bookings.checkInSlotEnd)));
      }
      changes.push({
        bookingCode: row.code,
        start: row.start.toISOString(),
        end: end.toISOString(),
      });
    }
    return changes;
  });
  console.log(
    JSON.stringify(
      { mode: apply ? "applied" : "dry-run", count: result.length, changes: result },
      null,
      2,
    ),
  );
} finally {
  await queryClient.end();
}
