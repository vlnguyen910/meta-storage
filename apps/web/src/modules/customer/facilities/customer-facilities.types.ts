export type FacilityViewMode = "grid" | "table";

export interface CustomerFacilitiesFilters {
  search: string;
  city: string;
  sort: "name" | "price";
  page: number;
  viewMode: FacilityViewMode;
}
