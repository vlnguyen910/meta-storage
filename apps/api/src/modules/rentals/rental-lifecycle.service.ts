import type { rentals } from "@metastorage/database";
import { lifecycleExpiryDetail } from "../notifications/lifecycle-notifications.messages";
import { recordLifecycleEvent } from "../notifications/lifecycle-notifications.repository";
import type { NotificationTransaction } from "../notifications/lifecycle-notifications.types";
import { localDate } from "../returns/returns.policy";
import type { ReturnsRepository } from "../returns/returns.repository";
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
  const days =
    dayIndex(localDate(rental.expectedEndAt, calendar.timezone)) -
    dayIndex(localDate(now, calendar.timezone));
  if (days >= 0 && days < 30)
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
    const candidates = await this.repository.candidates(now, facilityId);
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
        if (daysOverdue > 0 && !returnedOnTime && rental.status !== "OVERDUE") {
          await this.returns.updateRental(tx, rental.id, { status: "OVERDUE" });
          await recordLifecycleEvent(tx, {
            key: `rental:${rental.id}:overdue`,
            type: "RENTAL_OVERDUE",
            bookingId: rental.bookingId,
            managers: true,
            detail: lifecycleExpiryDetail(expiry),
            occurredAt: now,
          });
        }
        if (daysOverdue >= 8 && !rental.actualReturnAt && !rental.abandonedReviewAt) {
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
          (daysOverdue > -30 || (daysOverdue === -30 && clock >= calendar.reminderTime))
        )
          await recordLifecycleEvent(tx, {
            key: `rental:${rental.id}:expiry`,
            type: "UPCOMING_EXPIRY",
            bookingId: rental.bookingId,
            detail: lifecycleExpiryDetail(expiry),
            occurredAt: now,
          });
      });
    return { processed: candidates.length };
  }
}
