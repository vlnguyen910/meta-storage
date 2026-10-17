export type FacilityManagerDashboardTab = "overview" | "check-in" | "staff";

export interface FacilityCapabilityCard {
  id: string;
  title: string;
  description: string;
  tabTarget: FacilityManagerDashboardTab;
  badge?: string;
}
