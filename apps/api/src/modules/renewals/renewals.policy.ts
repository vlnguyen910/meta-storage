import type { rentals } from "@metastorage/database";
import type { RenewalFailure, RenewalRecord } from "./renewals.types";

export const RENEWAL_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export function renewalTermFailure(
  rental: typeof rentals.$inferSelect,
  quote: Pick<RenewalRecord, "oldEndAt" | "rentalVersion" | "expiresAt" | "cutoffAt">,
  at: Date,
): RenewalFailure | null {
  if (rental.status !== "ACTIVE" || rental.closedAt || rental.actualReturnAt) return "ineligible";
  if (
    rental.version !== quote.rentalVersion ||
    rental.expectedEndAt.getTime() !== quote.oldEndAt.getTime()
  )
    return "stale";
  if (at > quote.cutoffAt) return "cutoff";
  if (at > quote.expiresAt) return "expired";
  return null;
}
