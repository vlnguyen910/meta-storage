import {
  and,
  type Database,
  eq,
  facilityOperatingHours,
  facilityReturnCalendars,
  gt,
  inArray,
  isNull,
  notExists,
  notificationOutbox,
  rentals,
  sql,
  systemSettingInteger,
  systemSettings,
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
  async settings() {
    const rows = await this.db
      .select({ key: systemSettings.key, value: systemSettingInteger })
      .from(systemSettings)
      .where(inArray(systemSettings.key, ["EXPIRY_REMINDER_DAYS", "ABANDONED_REVIEW_DAYS"]));
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }
  candidates(
    now: Date,
    settings: { expiryReminderDays: number; abandonedReviewDays: number },
    facilityId?: string,
    afterId?: string,
  ) {
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
    const expiryReminderDays = sql`${settings.expiryReminderDays}::integer`;
    const abandonedReviewDays = sql`${settings.abandonedReviewDays}::integer`;
    const today = sql`(${now.toISOString()}::timestamptz at time zone ${timezone})::date`;
    const expiry = sql`(${rentals.expectedEndAt} at time zone ${timezone})::date`;
    const dueReminder = this.db
      .select({ id: notificationOutbox.id })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.eventKey, sql`'rental:' || ${rentals.id}::text || ':expiry'`));
    const overdueEvent = this.db
      .select({ id: notificationOutbox.id })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.eventKey, sql`'rental:' || ${rentals.id}::text || ':overdue'`));
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
          afterId ? gt(rentals.id, afterId) : undefined,
          facilityId ? eq(rentals.facilityId, facilityId) : undefined,
          sql`(
          (${today} > ${expiry} AND (${rentals.status} <> 'OVERDUE' OR ${notExists(overdueEvent)})
            AND (${rentals.actualReturnAt} IS NULL OR (${rentals.actualReturnAt} AT TIME ZONE ${timezone})::date > ${expiry}))
          OR (${today} - ${expiry} > ${abandonedReviewDays} AND ${rentals.actualReturnAt} IS NULL AND ${rentals.abandonedReviewAt} IS NULL)
          OR (${today} - ${expiry} >= -${expiryReminderDays} AND ${today} <= ${expiry}
            AND (${today} - ${expiry} > -${expiryReminderDays} OR (${now.toISOString()}::timestamptz AT TIME ZONE ${timezone})::time >= ${reminderTime}::time)
            AND ${notExists(dueReminder)})
        )`,
        ),
      )
      .orderBy(rentals.id)
      .limit(100);
  }
}
