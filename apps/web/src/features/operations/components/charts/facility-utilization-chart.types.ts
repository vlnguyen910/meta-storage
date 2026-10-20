import type { ReportFacility, ReportInventoryMetrics } from "@metastorage/contracts";
export interface FacilityUtilizationChartProps {
  items: { facility: ReportFacility; metrics: ReportInventoryMetrics }[];
  totalFacilities: number;
}
