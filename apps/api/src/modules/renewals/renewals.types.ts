import type { bookings, Database, rentalRenewals, rentals } from "@metastorage/database";

export type RenewalTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type RenewalRecord = typeof rentalRenewals.$inferSelect;
export type RenewalFailure =
  | "ineligible"
  | "cutoff"
  | "expired"
  | "returnStarted"
  | "debt"
  | "capacity"
  | "stale"
  | "configuration";
export type PayableRenewal =
  | { failure: RenewalFailure }
  | {
      quote: RenewalRecord;
      rental: typeof rentals.$inferSelect;
      booking: typeof bookings.$inferSelect;
    };
