import {
  and,
  type Database,
  eq,
  facilityOperatingHours,
  facilityReturnCalendars,
  inArray,
  isNull,
  notExists,
  notificationOutbox,
  rentals,
  sql,
} from "@metastorage/database";

import type { NotificationTransaction } from "../notifications/lifecycle-notifications.types";

export async function facilityLifecycleClock(tx: NotificationTransaction, facilityId: string) {
  const [calendar] = await tx
    .select()
    .from(facilityReturnCalendars)
    .where(eq(facilityReturnCalendars.facilityId, facilityId));
  if (calendar) return { timezone: calendar.timezone, reminderTime: calendar.reminderTime };
  const hours = await tx
    .select({ timezone: facilityOperatingHours.timezone })
    .from(facilityOperatingHours)
    .where(eq(facilityOperatingHours.facilityId, facilityId));
  const timezones = new Set(hours.map((row) => row.timezone));
  if (timezones.size !== 1) return undefined;
  return { timezone: hours[0]?.timezone ?? "", reminderTime: "09:00" };
}

export class RentalLifecycleRepository {
  constructor(private readonly db: Database) {}
  candidates(now: Date, facilityId?: string) {
    // Facility-local calendar boundaries and date subtraction cannot be expressed
    // with Drizzle comparison helpers; keep timezone arithmetic inside PostgreSQL.
    // Reuse the existing facility operating-hours timezone when no return calendar
    // exists. The aggregate excludes inconsistent/missing facility timezones.
    const operatingTimezones = this.db.$with("operating_timezones").as(
      this.db
        .select({
          facilityId: facilityOperatingHours.facilityId,
          timezone: sql<string>`min(${facilityOperatingHours.timezone})`.as("operating_timezone"),
        })
        .from(facilityOperatingHours)
        .groupBy(facilityOperatingHours.facilityId)
        .having(sql`count(distinct ${facilityOperatingHours.timezone}) = 1`),
    );
    const timezone = sql`coalesce(${facilityReturnCalendars.timezone}, ${operatingTimezones.timezone})`;
    const reminderTime = sql`coalesce(${facilityReturnCalendars.reminderTime}, '09:00')`;
    const today = sql`(${now.toISOString()}::timestamptz at time zone ${timezone})::date`;
    const expiry = sql`(${rentals.expectedEndAt} at time zone ${timezone})::date`;
    const dueReminder = this.db
      .select({ id: notificationOutbox.id })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.eventKey, sql`'rental:' || ${rentals.id}::text || ':expiry'`));
    return this.db
      .with(operatingTimezones)
      .select({ id: rentals.id })
      .from(rentals)
      .leftJoin(facilityReturnCalendars, eq(facilityReturnCalendars.facilityId, rentals.facilityId))
      .leftJoin(operatingTimezones, eq(operatingTimezones.facilityId, rentals.facilityId))
      .where(
        and(
          inArray(rentals.status, ["ACTIVE", "RETURN_PENDING", "OVERDUE"]),
          isNull(rentals.closedAt),
          facilityId ? eq(rentals.facilityId, facilityId) : undefined,
          sql`(
          (${today} > ${expiry} AND ${rentals.status} <> 'OVERDUE'
            AND (${rentals.actualReturnAt} IS NULL OR (${rentals.actualReturnAt} AT TIME ZONE ${timezone})::date > ${expiry}))
          OR (${today} >= ${expiry} + 8 AND ${rentals.actualReturnAt} IS NULL AND ${rentals.abandonedReviewAt} IS NULL)
          OR (${today} >= ${expiry} - 30 AND ${today} <= ${expiry}
            AND (${today} > ${expiry} - 30 OR (${now.toISOString()}::timestamptz AT TIME ZONE ${timezone})::time >= ${reminderTime}::time)
            AND ${notExists(dueReminder)})
        )`,
        ),
      )
      .orderBy(rentals.expectedEndAt, rentals.id)
      .limit(100);
  }
}
