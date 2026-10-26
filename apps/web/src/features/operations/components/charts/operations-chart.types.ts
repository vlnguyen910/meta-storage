import type {
  MonthlyRevenueReport,
  ReportFacility,
  ReportFinancialMetrics,
  ReportInventoryMetrics,
} from "@metastorage/contracts";
export interface FinancialChartProps {
  metrics: ReportFinancialMetrics;
  compact?: boolean;
}
export interface MonthlyChartProps {
  report: MonthlyRevenueReport;
}
export interface FacilityRevenueChartProps {
  items: { facility: ReportFacility; metrics: ReportFinancialMetrics }[];
  totalFacilities: number;
  limit?: number;
  showFullReportLink?: boolean;
}
export interface FacilityUtilizationBarChartProps {
  items: { facility: ReportFacility; metrics: ReportInventoryMetrics }[];
  totalFacilities: number;
}
