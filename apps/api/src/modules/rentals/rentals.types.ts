import type { Database, Role } from "@metastorage/database";

export type RentalActor = { id: string; role?: Role | null };
export type RentalQueryExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];
export type RentalWithDetails = Awaited<
  ReturnType<import("./rentals.repository").RentalsRepository["findCustomerRentals"]>
>[number];

export type RentalTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
