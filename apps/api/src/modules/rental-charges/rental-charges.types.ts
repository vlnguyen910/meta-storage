import type { RentalCharge, RentalChargeEvent, Role } from "@metastorage/database";

export type RentalChargeActor = { id: string; role: Role };
export type RentalChargeDetail = { charge: RentalCharge; events: RentalChargeEvent[] };
export type FacilityChargeReadExecutor =
  | import("@metastorage/database").Database
  | Parameters<Parameters<import("@metastorage/database").Database["transaction"]>[0]>[0];
export type FacilityChargeReadRow = Awaited<
  ReturnType<import("./rental-charges.repository").RentalChargesRepository["listForFacility"]>
>["items"][number];
