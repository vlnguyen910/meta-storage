export type StorageHubTab = "rentals" | "reservations" | "appointments";
export type StorageRentalView = "current" | "history";

export interface CustomerStorageHubProps {
  defaultTab?: StorageHubTab;
}

export interface CustomerStorageRentalsFilters {
  search: string;
  view: StorageRentalView;
  page: number;
}

export interface CustomerStorageBookingsFilters {
  search: string;
  status: string;
  page: number;
}
