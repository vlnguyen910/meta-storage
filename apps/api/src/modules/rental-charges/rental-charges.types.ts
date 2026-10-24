import type { RentalCharge, RentalChargeEvent, Role } from "@metastorage/database";

export type RentalChargeActor = { id: string; role: Role };
export type RentalChargeDetail = { charge: RentalCharge; events: RentalChargeEvent[] };
