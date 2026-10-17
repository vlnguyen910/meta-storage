import { z } from "zod";
import { REPORT_MESSAGES as m } from "./reports.messages";

export { REPORT_MESSAGES } from "./reports.messages";
export type {
  OperationsOverview,
  ReconciliationReport,
  RentalReport,
  RentalReportItem,
  ReportFacility,
  ReportFinancialMetrics,
  ReportInventoryMetrics,
  ReportPeriod,
  RevenueReport,
  UtilizationReport,
} from "./reports.types";

const scope = { facilityId: z.uuid().optional(), unitTypeId: z.uuid().optional() };
const page = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
};
const period = { from: z.iso.date().optional(), to: z.iso.date().optional() };
export const RevenueReportQuerySchema = z
  .strictObject({ ...scope, ...page, ...period })
  .refine((q) => (!q.from && !q.to) || Boolean(q.from && q.to && q.to >= q.from), {
    message: m.invalidPeriod,
    path: ["from"],
  });
export const UtilizationReportQuerySchema = z.strictObject({ ...scope, ...page });
export const RentalReportQuerySchema = z.strictObject({
  ...scope,
  ...page,
  status: z.string().trim().min(1).max(50).optional(),
});
export const ReportExportQuerySchema = z
  .strictObject({
    ...scope,
    ...period,
    type: z.enum(["revenue", "utilization", "rentals"]),
    status: z.string().trim().min(1).max(50).optional(),
  })
  .refine((q) => (!q.from && !q.to) || Boolean(q.from && q.to && q.to >= q.from), {
    message: m.invalidPeriod,
    path: ["from"],
  })
  .refine(
    (q) => (q.type === "revenue" || (!q.from && !q.to)) && (q.type === "rentals" || !q.status),
    { message: m.invalidExportFilter },
  );
export type RevenueReportQuery = z.infer<typeof RevenueReportQuerySchema>;
export type UtilizationReportQuery = z.infer<typeof UtilizationReportQuerySchema>;
export type RentalReportQuery = z.infer<typeof RentalReportQuerySchema>;
export type ReportExportQuery = z.infer<typeof ReportExportQuerySchema>;
