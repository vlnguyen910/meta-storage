import { FacilityTaskStatus } from "@metastorage/contracts/facility-tasks";
import { and, bookings, type Database, eq, facilityTasks, inArray } from "@metastorage/database";

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
            inArray(facilityTasks.status, [
              FacilityTaskStatus.ASSIGNED,
              FacilityTaskStatus.IN_PROGRESS,
            ]),
            facilityId ? eq(facilityTasks.facilityId, facilityId) : undefined,
          ),
        ),
    )
    .limit(1);
  return rows.length > 0;
}
