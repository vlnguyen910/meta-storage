import type { ApiUnitType } from "./unit-types";

export interface FacilityUnitTypeDto extends ApiUnitType {
  facilityId: string;
  priceRangeId: string;
  version: number;
  updatedBy: string | null;
}
