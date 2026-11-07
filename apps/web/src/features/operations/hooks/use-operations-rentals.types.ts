import type { RentalStatus } from "@metastorage/contracts";

export interface OperationsRentalsFilter {
  facilityId?: string;
  unitTypeId?: string;
  status?: RentalStatus;
  limit?: number;
  offset?: number;
}
