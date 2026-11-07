import type { ApiUnitType } from "./unit-types";

export interface FacilityUnitTypeDto extends ApiUnitType {
  facilityId: string;
  catalogUnitTypeId?: string;
  minMonthlyPrice?: number;
  maxMonthlyPrice?: number;
  version: number;
  updatedBy: string | null;
}
