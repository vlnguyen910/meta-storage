import type { rentals } from "@metastorage/database";
import { lifecycleExpiryDetail } from "../notifications/lifecycle-notifications.messages";
import { recordLifecycleEvent } from "../notifications/lifecycle-notifications.repository";
import type { NotificationTransaction } from "../notifications/lifecycle-notifications.types";
import { localDate } from "../returns/returns.policy";

export function rentalLifecycleEventKey(
  rental: Pick<typeof rentals.$inferSelect, "id" | "version">,
  event: "expiry" | "overdue" | "abandoned-review",
) {
  const term = rental.version === 0 ? "" : `:term:${rental.version}`;
  return `rental:${rental.id}${term}:${event}`;
}

export function recordOverdueEvent(
  tx: NotificationTransaction,
  rental: Pick<typeof rentals.$inferSelect, "id" | "bookingId" | "expectedEndAt" | "version">,
  timezone: string,
  occurredAt: Date,
) {
  return recordLifecycleEvent(tx, {
    key: rentalLifecycleEventKey(rental, "overdue"),
    rentalTermVersion: rental.version,
    type: "RENTAL_OVERDUE",
    bookingId: rental.bookingId,
    managers: true,
    detail: lifecycleExpiryDetail(localDate(rental.expectedEndAt, timezone)),
    occurredAt,
  });
}
