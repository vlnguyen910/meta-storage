export type CustomerDashboardTab = "bookings" | "rentals";

export interface CustomerDashboardState {
  activeTab: CustomerDashboardTab;
  bookingPage: number;
  rentalPage: number;
}
