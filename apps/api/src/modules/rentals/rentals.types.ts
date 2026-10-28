import type { Database, Role } from "@metastorage/database";

export type FacilityRentalActor = { id: string; role?: Role | null };
export type RentalReadExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];
export type FacilityRentalRow = Awaited<
  ReturnType<import("./rentals.repository").RentalsRepository["listForFacility"]>
>["items"][number];
