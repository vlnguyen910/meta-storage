export type StorageHubTab = "rentals" | "reservations" | "appointments";
export type StorageRentalView = "all" | "current" | "history";

export interface CustomerStorageHubProps {
  defaultTab?: StorageHubTab;
}
