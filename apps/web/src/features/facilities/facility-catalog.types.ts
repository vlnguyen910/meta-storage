import type { ApiFacility } from "@metastorage/contracts";

export interface FacilityCatalogItem extends ApiFacility {
  startingMonthlyPrice: number | null;
}

export interface FacilityCatalogFilters {
  search?: string;
  city?: string;
  sort?: "name" | "price";
  page?: number;
  pageSize?: number;
}

export interface FacilityUnitTypeOption {
  facilityId: string;
  unitTypeId: string;
  unitType: string;
  sizeLabel: string;
  sizeSqm: number;
  lengthM: number;
  widthM: number;
  heightM: number;
  monthlyPrice: number;
  availableCount: number | null;
}
