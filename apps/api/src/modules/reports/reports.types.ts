import type { UserRole } from "@metastorage/contracts";
import type { Database } from "@metastorage/database";
import type { ReportsRepository } from "./reports.repository";
export interface ReportActor {
  id: string;
  role: UserRole | null | undefined;
}
export interface ReportFilters {
  facilityId?: string;
  unitTypeId?: string;
}
export type ReportTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type ReportDataset = Awaited<ReturnType<ReportsRepository["read"]>>;
export type ReportFinancialRow = ReportDataset["financial"][number];
export type ReportChargePaymentRow = ReportDataset["chargePayments"][number];
export type ReportChargeRefundRow = ReportDataset["chargeRefunds"][number];
