import { RentalLifecycleSettingKey } from "@metastorage/contracts";
import type { rentals } from "@metastorage/database";
import { rentalLifecycleSettings } from "@metastorage/database";
import { lifecycleExpiryDetail } from "../notifications/lifecycle-notifications.messages";
import { recordLifecycleEvent } from "../notifications/lifecycle-notifications.repository";
import type { NotificationTransaction } from "../notifications/lifecycle-notifications.types";
import { localDate } from "../returns/returns.policy";
import type { ReturnsRepository } from "../returns/returns.repository";
import { recordOverdueEvent } from "./rental-lifecycle.events";
import {
  facilityLifecycleClock,
  type RentalLifecycleRepository,
} from "./rental-lifecycle.repository";

function dayIndex(date: string) {
  return Date.parse(`${date}T00:00:00Z`) / 86400000;
}

export async function recordImmediateExpiry(
  tx: NotificationTransaction,
  rental: typeof rentals.$inferSelect,
  now: Date,
) {
  const calendar = await facilityLifecycleClock(tx, rental.facilityId);
  if (!calendar) return; // Missing facility timezone is configuration work, never guess a timezone.
  const settings = await tx.select().from(rentalLifecycleSettings);
  const reminderDays = settings.find(
    (setting) => setting.key === RentalLifecycleSettingKey.EXPIRY_REMINDER_DAYS,
  )?.value;
  if (reminderDays === undefined) return;
  const days =
    dayIndex(localDate(rental.expectedEndAt, calendar.timezone)) -
    dayIndex(localDate(now, calendar.timezone));
  if (days >= 0 && days < reminderDays)
    await recordLifecycleEvent(tx, {
      key: `rental:${rental.id}:expiry`,
      type: "UPCOMING_EXPIRY",
      bookingId: rental.bookingId,
      detail: lifecycleExpiryDetail(localDate(rental.expectedEndAt, calendar.timezone)),
      occurredAt: now,
    });
}

export class RentalLifecycleService {
  constructor(
    private readonly repository: RentalLifecycleRepository,
    private readonly returns: ReturnsRepository,
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
        await this.returns.locked(candidate.id, async (tx, { rental }) => {
          if (rental.closedAt || rental.status === "CLOSED") return;
          const calendar = await facilityLifecycleClock(tx, rental.facilityId);
          if (!calendar) return;
          const today = localDate(now, calendar.timezone),
            expiry = localDate(rental.expectedEndAt, calendar.timezone);
          const daysOverdue = dayIndex(today) - dayIndex(expiry);
          const returnedOnTime =
            rental.actualReturnAt && localDate(rental.actualReturnAt, calendar.timezone) <= expiry;
          if (daysOverdue > 0 && !returnedOnTime) {
            if (rental.status !== "OVERDUE")
              await this.returns.updateRental(tx, rental.id, { status: "OVERDUE" });
            await recordOverdueEvent(tx, rental, calendar.timezone, now);
          }
          if (
            daysOverdue > 0 &&
            daysOverdue - 1 >= abandonedReviewDays &&
            !rental.actualReturnAt &&
            !rental.abandonedReviewAt
          ) {
            await this.returns.updateRental(tx, rental.id, { abandonedReviewAt: now });
            await recordLifecycleEvent(tx, {
              key: `rental:${rental.id}:abandoned-review`,
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
            daysOverdue <= 0 &&
            (daysOverdue > -expiryReminderDays ||
              (daysOverdue === -expiryReminderDays && clock >= calendar.reminderTime))
          )
            await recordLifecycleEvent(tx, {
              key: `rental:${rental.id}:expiry`,
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
