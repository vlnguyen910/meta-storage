export interface DashboardKpi {
  label: string;
  value: string;
  helper: string;
  tone: "primary" | "accent" | "warning" | "neutral";
}

export interface DashboardActivity {
  id: string;
  title: string;
  description: string;
  time: string;
}

export interface DashboardSummary {
  title: string;
  subtitle: string;
  facilityName?: string;
  kpis: DashboardKpi[];
  activities: DashboardActivity[];
}
