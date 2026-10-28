import type { bookings, Database, Role, rentals } from "@metastorage/database";

export type FacilityRentalActor = { id: string; role?: Role | null };
export type RentalReadExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];
export type RentalTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type RentalContext = {
  booking: typeof bookings.$inferSelect;
  rental: typeof rentals.$inferSelect;
};
export type FacilityRentalRow = Awaited<
  ReturnType<import("./rentals.repository").RentalsRepository["listForFacility"]>
>["items"][number];
