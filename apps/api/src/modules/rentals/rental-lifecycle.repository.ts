import {
  and,
  type Database,
  eq,
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

export async function facilityLifecycleClock(_tx: NotificationTransaction, _facilityId: string) {
  return { timezone: "Asia/Ho_Chi_Minh", reminderTime: "09:00" };
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
    const timezone = sql`'Asia/Ho_Chi_Minh'`;
    const reminderTime = sql`'09:00'`;
    const expiryReminderDays = sql`${settings.expiryReminderDays}::integer`;
    const abandonedReviewDays = sql`${settings.abandonedReviewDays}::integer`;
    const today = sql`(${now.toISOString()}::timestamptz at time zone ${timezone})::date`;
    const expiry = sql`(${rentals.expectedEndAt} at time zone ${timezone})::date`;
    const termKey = sql`'rental:' || ${rentals.id}::text || case when ${rentals.version} = 0 then '' else ':term:' || ${rentals.version}::text end`;
    const dueReminder = this.db
      .select({ id: notificationOutbox.id })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.eventKey, sql`${termKey} || ':expiry'`));
    const overdueEvent = this.db
      .select({ id: notificationOutbox.id })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.eventKey, sql`${termKey} || ':overdue'`));
    return this.db
      .select({ id: rentals.id })
      .from(rentals)
      .where(
        and(
          inArray(rentals.status, ["ACTIVE", "RETURN_PENDING", "OVERDUE"]),
          isNull(rentals.closedAt),
          afterId ? gt(rentals.id, afterId) : undefined,
          facilityId ? eq(rentals.facilityId, facilityId) : undefined,
          sql`(
          (${now.toISOString()}::timestamptz >= ${rentals.expectedEndAt} AND (${rentals.status} <> 'OVERDUE' OR ${notExists(overdueEvent)})
            AND (${rentals.actualReturnAt} IS NULL OR ${rentals.actualReturnAt} > ${rentals.expectedEndAt}))
          OR (${today} - ${expiry} > ${abandonedReviewDays} AND ${rentals.actualReturnAt} IS NULL AND ${rentals.abandonedReviewAt} IS NULL)
          OR (${now.toISOString()}::timestamptz < ${rentals.expectedEndAt} AND ${today} - ${expiry} >= -${expiryReminderDays} AND ${today} <= ${expiry}
            AND (${today} - ${expiry} > -${expiryReminderDays} OR (${now.toISOString()}::timestamptz AT TIME ZONE ${timezone})::time >= ${reminderTime}::time)
            AND ${notExists(dueReminder)})
        )`,
        ),
      )
      .orderBy(rentals.id)
      .limit(100);
  }
}
