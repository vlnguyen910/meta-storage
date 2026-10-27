import type { ReportInventoryMetrics } from "@metastorage/contracts";
export interface FacilityUtilizationDonutChartProps {
  metrics: ReportInventoryMetrics;
  compact?: boolean;
}
