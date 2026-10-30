import { FacilityTaskStatus } from "@metastorage/contracts/facility-tasks";
import {
  and,
  appointments,
  type Database,
  eq,
  facilityTasks,
  inArray,
} from "@metastorage/database";
import { APPOINTMENT_STATUSES } from "@metastorage/database/schema/appointments";

type WorkConnection = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function hasOpenAssignedWork(
  connection: WorkConnection,
  userId: string,
  facilityId?: string,
): Promise<boolean> {
  const rows = await connection
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.assignedStaffId, userId),
        inArray(appointments.status, [
          APPOINTMENT_STATUSES.SCHEDULED,
          APPOINTMENT_STATUSES.CONFIRMED,
        ]),
        facilityId ? eq(appointments.facilityId, facilityId) : undefined,
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
