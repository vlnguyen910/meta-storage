import type { rentals } from "@metastorage/database";
import { lifecycleExpiryDetail } from "../notifications/lifecycle-notifications.messages";
import { recordLifecycleEvent } from "../notifications/lifecycle-notifications.repository";
import type { NotificationTransaction } from "../notifications/lifecycle-notifications.types";
import { localDate } from "../returns/returns.policy";

export function recordOverdueEvent(
  tx: NotificationTransaction,
  rental: Pick<typeof rentals.$inferSelect, "id" | "bookingId" | "expectedEndAt">,
  timezone: string,
  occurredAt: Date,
) {
  return recordLifecycleEvent(tx, {
    key: `rental:${rental.id}:overdue`,
    type: "RENTAL_OVERDUE",
    bookingId: rental.bookingId,
    managers: true,
    detail: lifecycleExpiryDetail(localDate(rental.expectedEndAt, timezone)),
    occurredAt,
  });
}
