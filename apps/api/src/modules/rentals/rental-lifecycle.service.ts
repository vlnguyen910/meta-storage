import { RentalLifecycleSettingKey } from "@metastorage/contracts";
import type { rentals } from "@metastorage/database";
import { eq, systemSettingInteger, systemSettings } from "@metastorage/database";
import { localDate } from "../../common/date";
import { lifecycleExpiryDetail } from "../notifications/lifecycle-notifications.messages";
import { recordLifecycleEvent } from "../notifications/lifecycle-notifications.repository";
import type { NotificationTransaction } from "../notifications/lifecycle-notifications.types";
import { recordOverdueEvent, rentalLifecycleEventKey } from "./rental-lifecycle.events";
import {
  facilityLifecycleClock,
  type RentalLifecycleRepository,
} from "./rental-lifecycle.repository";
import type { RentalsRepository } from "./rentals.repository";

function dayIndex(date: string) {
  return Date.parse(`${date}T00:00:00Z`) / 86400000;
}

export async function recordImmediateExpiry(
  tx: NotificationTransaction,
  rental: typeof rentals.$inferSelect,
  now: Date,
) {
  if (now >= rental.expectedEndAt) return;
  const calendar = await facilityLifecycleClock(tx, rental.facilityId);
  if (!calendar) return; // Missing facility timezone is configuration work, never guess a timezone.
  const settings = await tx
    .select({ key: systemSettings.key, value: systemSettingInteger })
    .from(systemSettings)
    .where(eq(systemSettings.key, RentalLifecycleSettingKey.EXPIRY_REMINDER_DAYS));
  const reminderDays = settings.find(
    (setting) => setting.key === RentalLifecycleSettingKey.EXPIRY_REMINDER_DAYS,
  )?.value;
  if (reminderDays === undefined) return;
  const days =
    dayIndex(localDate(rental.expectedEndAt, calendar.timezone)) -
    dayIndex(localDate(now, calendar.timezone));
  if (days >= 0 && days < reminderDays)
    await recordLifecycleEvent(tx, {
      key: rentalLifecycleEventKey(rental, "expiry"),
      rentalTermVersion: rental.version,
      type: "UPCOMING_EXPIRY",
      bookingId: rental.bookingId,
      detail: lifecycleExpiryDetail(localDate(rental.expectedEndAt, calendar.timezone)),
      occurredAt: now,
    });
}

export class RentalLifecycleService {
  constructor(
    private readonly repository: RentalLifecycleRepository,
    private readonly rentals: RentalsRepository,
  ) {}
  async sweep(now = new Date(), facilityId?: string) {
    const settings = await this.repository.settings();
    const expiryReminderDays = settings[RentalLifecycleSettingKey.EXPIRY_REMINDER_DAYS];
    const abandonedReviewDays = settings[RentalLifecycleSettingKey.ABANDONED_REVIEW_DAYS];
    if (expiryReminderDays === undefined || abandonedReviewDays === undefined)
      throw new Error("Rental lifecycle settings are missing");
    const lifecycleSettings = { expiryReminderDays, abandonedReviewDays };
    let processed = 0;
    let afterId: string | undefined;
    while (true) {
      const candidates = await this.repository.candidates(
        now,
        lifecycleSettings,
        facilityId,
        afterId,
      );
      if (!candidates.length) break;
      for (const candidate of candidates)
        await this.rentals.withLockedRental(candidate.id, async (tx, { rental }) => {
          if (rental.closedAt || rental.status === "CLOSED") return;
          const calendar = await facilityLifecycleClock(tx, rental.facilityId);
          if (!calendar) return;
          const today = localDate(now, calendar.timezone),
            expiry = localDate(rental.expectedEndAt, calendar.timezone);
          const daysOverdue = dayIndex(today) - dayIndex(expiry);
          const expired = now >= rental.expectedEndAt;
          const returnedOnTime =
            rental.actualReturnAt && rental.actualReturnAt <= rental.expectedEndAt;
          if (expired && !returnedOnTime) {
            if (rental.status !== "OVERDUE")
              await this.repository.update(tx, rental.id, { status: "OVERDUE" });
            await recordOverdueEvent(tx, rental, calendar.timezone, now);
          }
          if (
            daysOverdue > 0 &&
            daysOverdue - 1 >= abandonedReviewDays &&
            !rental.actualReturnAt &&
            !rental.abandonedReviewAt
          ) {
            await this.repository.update(tx, rental.id, { abandonedReviewAt: now });
            await recordLifecycleEvent(tx, {
              key: rentalLifecycleEventKey(rental, "abandoned-review"),
              rentalTermVersion: rental.version,
              type: "ABANDONED_REVIEW",
              bookingId: rental.bookingId,
              managers: true,
              customer: false,
              occurredAt: now,
            });
          }
          const clock = new Intl.DateTimeFormat("en-GB", {
            timeZone: calendar.timezone,
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          }).format(now);
          if (
            !expired &&
            (daysOverdue > -expiryReminderDays ||
              (daysOverdue === -expiryReminderDays && clock >= calendar.reminderTime))
          )
            await recordLifecycleEvent(tx, {
              key: rentalLifecycleEventKey(rental, "expiry"),
              rentalTermVersion: rental.version,
              type: "UPCOMING_EXPIRY",
              bookingId: rental.bookingId,
              detail: lifecycleExpiryDetail(expiry),
              occurredAt: now,
            });
        });
      processed += candidates.length;
      afterId = candidates.at(-1)?.id;
      if (candidates.length < 100) break;
    }
    return { processed };
  }
}
