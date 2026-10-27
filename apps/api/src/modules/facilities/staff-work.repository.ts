import {
  and,
  bookings,
  type Database,
  eq,
  facilityTasks,
  inArray,
  returnRequests,
} from "@metastorage/database";

type WorkConnection = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function hasOpenAssignedWork(
  connection: WorkConnection,
  userId: string,
  facilityId?: string,
): Promise<boolean> {
  const rows = await connection
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.assignedStaffId, userId),
        eq(bookings.status, "CONFIRMED"),
        facilityId ? eq(bookings.facilityId, facilityId) : undefined,
      ),
    )
    .unionAll(
      connection
        .select({ id: facilityTasks.id })
        .from(facilityTasks)
        .where(
          and(
            eq(facilityTasks.assignedStaffId, userId),
            inArray(facilityTasks.status, ["ASSIGNED", "IN_PROGRESS", "AWAITING_APPROVAL"]),
            facilityId ? eq(facilityTasks.facilityId, facilityId) : undefined,
          ),
        ),
    )
    .unionAll(
      connection
        .select({ id: returnRequests.id })
        .from(returnRequests)
        .where(
          and(
            eq(returnRequests.assignedStaffId, userId),
            inArray(returnRequests.status, ["PENDING", "CONFIRMED", "INSPECTING", "FAILED"]),
            facilityId ? eq(returnRequests.facilityId, facilityId) : undefined,
          ),
        ),
    )
    .limit(1);
  return rows.length > 0;
}
