import { z } from "zod";
import { RentalStatus } from "./rentals";
import { REPORT_MESSAGES as m } from "./reports.messages";

export { REPORT_MESSAGES } from "./reports.messages";
export type {
  MonthlyRevenuePoint,
  MonthlyRevenueReport,
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
  status: z.enum(RentalStatus).optional(),
});
export const ReportExportQuerySchema = z
  .strictObject({
    ...scope,
    ...period,
    type: z.enum(["revenue", "revenue-monthly", "utilization", "rentals"]),
    status: z.enum(RentalStatus).optional(),
  })
  .refine((q) => (!q.from && !q.to) || Boolean(q.from && q.to && q.to >= q.from), {
    message: m.invalidPeriod,
    path: ["from"],
  })
  .refine(
    (q) =>
      (["revenue", "revenue-monthly"].includes(q.type) || (!q.from && !q.to)) &&
      (q.type === "rentals" || !q.status),
    { message: m.invalidExportFilter },
  )
  .refine(
    (q) =>
      q.type !== "revenue-monthly" ||
      !q.from ||
      !q.to ||
      (Number(q.to.slice(0, 4)) - Number(q.from.slice(0, 4))) * 12 +
        Number(q.to.slice(5, 7)) -
        Number(q.from.slice(5, 7)) <
        60,
    { message: m.monthlyRange },
  );
export type RevenueReportQuery = z.infer<typeof RevenueReportQuerySchema>;
export const MonthlyRevenueQuerySchema = z
  .strictObject({ ...scope, ...period })
  .refine((q) => (!q.from && !q.to) || Boolean(q.from && q.to && q.to >= q.from), {
    message: m.invalidPeriod,
    path: ["from"],
  })
  .refine(
    (q) =>
      !q.from ||
      !q.to ||
      (Number(q.to.slice(0, 4)) - Number(q.from.slice(0, 4))) * 12 +
        Number(q.to.slice(5, 7)) -
        Number(q.from.slice(5, 7)) <
        60,
    {
      message: m.monthlyRange,
      path: ["to"],
    },
  );
export type MonthlyRevenueQuery = z.infer<typeof MonthlyRevenueQuerySchema>;
export type UtilizationReportQuery = z.infer<typeof UtilizationReportQuerySchema>;
export type RentalReportQuery = z.infer<typeof RentalReportQuerySchema>;
export type ReportExportQuery = z.infer<typeof ReportExportQuerySchema>;
