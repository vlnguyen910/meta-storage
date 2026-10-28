import {
  type MonthlyRevenueQuery,
  type MonthlyRevenueReport,
  REPORT_MESSAGES as m,
  type OperationsOverview,
  type ReconciliationReport,
  type RentalReport,
  type RentalReportQuery,
  type ReportExportQuery,
  type ReportFinancialMetrics,
  type ReportInventoryMetrics,
  type RevenueReport,
  type RevenueReportQuery,
  type UtilizationReport,
  type UtilizationReportQuery,
} from "@metastorage/contracts";
import { AppError } from "../../common/errors/app-error";
import { csv, formatCents, parseCents, resolveReportPeriod } from "./reports.calculation";
import type { ReportsRepository } from "./reports.repository";
import type {
  ReportActor,
  ReportChargePaymentRow,
  ReportChargeRefundRow,
  ReportDataset,
  ReportFinancialRow,
} from "./reports.types";

// Resource bound for synchronous exports, not a business/financial threshold.
const MAX_SYNC_EXPORT_ROWS = 10000;

function financial(
  rows: ReportFinancialRow[],
  chargePayments: ReportChargePaymentRow[] = [],
  chargeRefunds: ReportChargeRefundRow[] = [],
): ReportFinancialMetrics {
  const money = (
    key:
      | "cashReceived"
      | "rentalCollected"
      | "depositCollected"
      | "cashRefunded"
      | "depositHeld"
      | "depositForfeited"
      | "pendingRefundAmount",
  ) => rows.reduce((sum, row) => sum + parseCents(row[key]), 0n);
  const total = (
    key:
      | "pendingRefundCount"
      | "paymentsReceivedCount"
      | "unclassifiedCollectedPayments"
      | "unclassifiedDepositPayments"
      | "unsupportedCurrencyPayments",
  ) => rows.reduce((sum, row) => sum + row[key], 0);
  const unclassified = total("unclassifiedCollectedPayments"),
    unknownDeposit = total("unclassifiedDepositPayments");
  const chargeMoney = (
    key: "cashReceived" | "renewalCollected" | "extraChargeCollected" | "returnDebtCollected",
  ) => chargePayments.reduce((sum, row) => sum + parseCents(row[key]), 0n);
  const cashReceived = money("cashReceived") + chargeMoney("cashReceived");
  const chargeRefunded = chargeRefunds.reduce(
    (sum, row) => sum + parseCents(row.chargeRefunded),
    0n,
  );
  const pendingChargeRefundAmount = chargeRefunds.reduce(
    (sum, row) => sum + parseCents(row.pendingChargeRefundAmount),
    0n,
  );
  return {
    cashReceived: formatCents(cashReceived),
    rentalCollected: unclassified ? null : formatCents(money("rentalCollected")),
    depositCollected: unclassified ? null : formatCents(money("depositCollected")),
    renewalCollected: formatCents(chargeMoney("renewalCollected")),
    extraChargeCollected: formatCents(chargeMoney("extraChargeCollected")),
    returnDebtCollected: formatCents(chargeMoney("returnDebtCollected")),
    cashRefunded: formatCents(money("cashRefunded") + chargeRefunded),
    chargeRefunded: formatCents(chargeRefunded),
    netCash: formatCents(cashReceived - money("cashRefunded") - chargeRefunded),
    depositHeld: unknownDeposit ? null : formatCents(money("depositHeld")),
    depositForfeited: formatCents(money("depositForfeited")),
    pendingRefundAmount: formatCents(money("pendingRefundAmount")),
    pendingRefundCount: total("pendingRefundCount"),
    pendingChargeRefundAmount: formatCents(pendingChargeRefundAmount),
    pendingChargeRefundCount: chargeRefunds.reduce(
      (sum, row) => sum + row.pendingChargeRefundCount,
      0,
    ),
    paymentsReceivedCount:
      total("paymentsReceivedCount") +
      chargePayments.reduce((sum, row) => sum + row.paymentsReceivedCount, 0),
    unclassifiedCollectedPayments: unclassified,
    unclassifiedDepositPayments: unknownDeposit,
    unsupportedCurrencyPayments:
      total("unsupportedCurrencyPayments") +
      chargePayments.reduce((sum, row) => sum + row.unsupportedCurrencyPayments, 0),
  };
}
function inventory(data: ReportDataset, id?: string): ReportInventoryMetrics {
  const rows = data.inventory.filter((row) => !id || row.facilityId === id);
  const count = (status: string) =>
    rows.filter((row) => row.status === status).reduce((sum, row) => sum + row.count, 0);
  const totalUnits = rows.reduce((sum, row) => sum + row.count, 0),
    inactiveUnits = count("INACTIVE"),
    activeUnits = totalUnits - inactiveUnits,
    occupiedUnits = count("OCCUPIED");
  return {
    totalUnits,
    inactiveUnits,
    activeUnits,
    occupiedUnits,
    availableUnits: count("AVAILABLE"),
    maintenanceUnits: count("MAINTENANCE"),
    reservedUnits: count("RESERVED"),
    inspectionUnits: count("INSPECTION"),
    returnPendingUnits: count("RETURN_PENDING"),
    lockedUnits: count("LOCKED"),
    utilizationPercent: activeUnits
      ? Number(((occupiedUnits * 100) / activeUnits).toFixed(2))
      : null,
    activeCheckoutHolds: data.holds
      .filter((row) => !id || row.facilityId === id)
      .reduce((sum, row) => sum + row.count, 0),
    confirmedAwaitingHandover: data.awaiting
      .filter((row) => !id || row.facilityId === id)
      .reduce((sum, row) => sum + row.count, 0),
  };
}

export class ReportsService {
  constructor(private readonly repository: ReportsRepository) {}
  async monthlyRevenue(
    query: MonthlyRevenueQuery,
    actor: ReportActor,
  ): Promise<MonthlyRevenueReport> {
    const now = new Date();
    const period = resolveReportPeriod(query, now);
    const data = await this.repository.monthlyRevenue(actor, query, period.start, period.end, now);
    const items: MonthlyRevenueReport["items"] = [];
    const first = Number(period.from.slice(0, 4)) * 12 + Number(period.from.slice(5, 7)) - 1;
    const last = Number(period.to.slice(0, 4)) * 12 + Number(period.to.slice(5, 7)) - 1;
    for (let index = first; index <= last; index++) {
      const month = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
      const receipt = data.receipts.find((row) => row.month === month);
      const refund = data.refunds.find((row) => row.month === month);
      const chargeReceipt = data.chargeReceipts.find((row) => row.month === month);
      const chargeRefund = data.chargeRefunds.find((row) => row.month === month);
      const received = formatCents(
        parseCents(receipt?.cashReceived ?? "0") + parseCents(chargeReceipt?.cashReceived ?? "0"),
      );
      const refunded = formatCents(
        parseCents(refund?.cashRefunded ?? "0") + parseCents(chargeRefund?.chargeRefunded ?? "0"),
      );
      items.push({
        month,
        cashReceived: received,
        cashRefunded: refunded,
        rentalCollected: receipt?.unclassified ? null : (receipt?.rentalCollected ?? "0.00"),
        depositCollected: receipt?.unclassified ? null : (receipt?.depositCollected ?? "0.00"),
        renewalCollected: chargeReceipt?.renewalCollected ?? "0.00",
        extraChargeCollected: chargeReceipt?.extraChargeCollected ?? "0.00",
        returnDebtCollected: chargeReceipt?.returnDebtCollected ?? "0.00",
        chargeRefunded: chargeRefund?.chargeRefunded ?? "0.00",
        netCash: formatCents(parseCents(received) - parseCents(refunded)),
        unsupportedCurrencyPayments:
          (receipt?.unsupportedCurrencyPayments ?? 0) +
          (chargeReceipt?.unsupportedCurrencyPayments ?? 0),
      });
    }
    return {
      period: { from: period.from, to: period.to, timeZone: period.timeZone },
      asOf: now.toISOString(),
      currency: "VND",
      items,
    };
  }
  async revenue(
    query: RevenueReportQuery,
    actor: ReportActor,
    all = false,
  ): Promise<RevenueReport> {
    const now = new Date(),
      period = resolveReportPeriod(query, now);
    const data = await this.repository.read(actor, query, period.start, period.end, now);
    const rows = data.facilities.map((facility) => ({
      facility,
      metrics: financial(
        data.financial.filter((row) => row.facilityId === facility.id),
        data.chargePayments.filter((row) => row.facilityId === facility.id),
        data.chargeRefunds.filter((row) => row.facilityId === facility.id),
      ),
    }));
    rows.sort((a, b) => {
      const delta =
        parseCents(b.metrics.rentalCollected ?? "0") - parseCents(a.metrics.rentalCollected ?? "0");
      return delta < 0n ? -1 : delta > 0n ? 1 : a.facility.code.localeCompare(b.facility.code);
    });
    const unattributed = data.financial.filter((row) => row.facilityId === null);
    return {
      period: { from: period.from, to: period.to, timeZone: period.timeZone },
      asOf: now.toISOString(),
      currency: "VND",
      summary: financial(data.financial, data.chargePayments, data.chargeRefunds),
      items: all ? rows : rows.slice(query.offset, query.offset + query.limit),
      unattributed: unattributed.length ? financial(unattributed) : null,
      total: rows.length,
      limit: query.limit,
      offset: query.offset,
    };
  }
  async utilization(
    query: UtilizationReportQuery,
    actor: ReportActor,
    all = false,
  ): Promise<UtilizationReport> {
    const now = new Date(),
      period = resolveReportPeriod({}, now);
    const data = await this.repository.read(actor, query, period.start, period.end, now, false);
    const rows = data.facilities.map((facility) => ({
      facility,
      metrics: inventory(data, facility.id),
    }));
    rows.sort(
      (a, b) =>
        (a.metrics.utilizationPercent ?? Infinity) - (b.metrics.utilizationPercent ?? Infinity) ||
        b.metrics.availableUnits - a.metrics.availableUnits ||
        a.facility.code.localeCompare(b.facility.code),
    );
    return {
      asOf: now.toISOString(),
      summary: inventory(data),
      items: all ? rows : rows.slice(query.offset, query.offset + query.limit),
      total: rows.length,
      limit: query.limit,
      offset: query.offset,
    };
  }
  async overview(query: RevenueReportQuery, actor: ReportActor): Promise<OperationsOverview> {
    const now = new Date(),
      period = resolveReportPeriod(query, now);
    const data = await this.repository.read(actor, query, period.start, period.end, now);
    const money = financial(data.financial, data.chargePayments, data.chargeRefunds),
      units = inventory(data);
    const rows = data.facilities.map((facility) => ({
      facility,
      financial: financial(
        data.financial.filter((row) => row.facilityId === facility.id),
        data.chargePayments.filter((row) => row.facilityId === facility.id),
        data.chargeRefunds.filter((row) => row.facilityId === facility.id),
      ),
      inventory: inventory(data, facility.id),
    }));
    rows.sort(
      (a, b) =>
        (a.inventory.utilizationPercent ?? Infinity) -
          (b.inventory.utilizationPercent ?? Infinity) ||
        b.inventory.availableUnits - a.inventory.availableUnits ||
        a.facility.code.localeCompare(b.facility.code),
    );
    const canManage = actor.role === "BUSINESS_OPERATION_MANAGER" || actor.role === "SYSTEM_ADMIN";
    return {
      period: { from: period.from, to: period.to, timeZone: period.timeZone },
      asOf: now.toISOString(),
      currency: "VND",
      summary: { financial: money, inventory: units },
      attention: {
        refunds: {
          count: money.pendingRefundCount,
          amount: money.pendingRefundAmount,
          canManage,
          endpoint: canManage ? "/api/payments/refunds" : null,
          description: m.refundAction,
        },
        chargeRefunds: {
          count: money.pendingChargeRefundCount,
          amount: money.pendingChargeRefundAmount,
          canManage,
          endpoint: canManage ? "/api/rental-charge-refunds" : null,
          description: m.chargeRefundAction,
        },
        vacantCapacity: { count: units.availableUnits, description: m.vacantAction },
        maintenance: { count: units.maintenanceUnits, description: m.maintenanceAction },
        dataQuality: {
          endpoint: "/api/reports/reconciliation",
          hasIssues:
            money.unclassifiedCollectedPayments > 0 ||
            money.unclassifiedDepositPayments > 0 ||
            money.unsupportedCurrencyPayments > 0,
          unclassifiedCollectedPayments: money.unclassifiedCollectedPayments,
          unclassifiedDepositPayments: money.unclassifiedDepositPayments,
          unsupportedCurrencyPayments: money.unsupportedCurrencyPayments,
          description: m.qualityAction,
        },
      },
      facilities: rows.slice(query.offset, query.offset + query.limit),
      total: rows.length,
      limit: query.limit,
      offset: query.offset,
    };
  }
  async reconciliation(
    query: UtilizationReportQuery,
    actor: ReportActor,
  ): Promise<ReconciliationReport> {
    const now = new Date();
    const data = await this.repository.reconciliation(actor, query, now);
    return {
      asOf: now.toISOString(),
      items: data.items.map((row) => ({ ...row, paidAt: row.paidAt?.toISOString() ?? null })),
      total: data.total,
      limit: query.limit,
      offset: query.offset,
    };
  }
  async rentals(query: RentalReportQuery, actor: ReportActor): Promise<RentalReport> {
    const asOf = new Date().toISOString();
    const result = await this.repository.rentalReport(actor, query);
    return {
      asOf,
      items: result.items.map((row) => ({
        ...row,
        startAt: row.startAt.toISOString(),
        expectedEndAt: row.expectedEndAt.toISOString(),
      })),
      byStatus: result.byStatus,
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    };
  }
  async export(query: ReportExportQuery, actor: ReportActor) {
    const base = {
      facilityId: query.facilityId,
      unitTypeId: query.unitTypeId,
      limit: MAX_SYNC_EXPORT_ROWS,
      offset: 0,
    };
    let body: string;
    if (query.type === "revenue-monthly") {
      const report = await this.monthlyRevenue(
        {
          facilityId: query.facilityId,
          unitTypeId: query.unitTypeId,
          from: query.from,
          to: query.to,
        },
        actor,
      );
      body = csv(
        m.monthlyHeaders,
        report.items.map((row) => [
          report.period.from,
          report.period.to,
          report.asOf,
          row.month,
          row.cashReceived,
          row.rentalCollected,
          row.depositCollected,
          row.renewalCollected,
          row.extraChargeCollected,
          row.returnDebtCollected,
          row.cashRefunded,
          row.chargeRefunded,
          row.netCash,
          row.unsupportedCurrencyPayments,
        ]),
      );
    } else if (query.type === "revenue") {
      const report = await this.revenue({ ...base, from: query.from, to: query.to }, actor, true);
      if (report.total > MAX_SYNC_EXPORT_ROWS) throw new AppError(m.exportTooLarge, 422);
      const rows = report.items.map((row) => ({
        code: row.facility.code,
        name: row.facility.name,
        metrics: row.metrics,
      }));
      if (report.unattributed)
        rows.push({ code: "", name: m.unattributed, metrics: report.unattributed });
      body = csv(
        m.revenueHeaders,
        rows.map(({ code, name, metrics: x }) => [
          report.period.from,
          report.period.to,
          report.asOf,
          code,
          name,
          x.cashReceived,
          x.rentalCollected,
          x.depositCollected,
          x.renewalCollected,
          x.extraChargeCollected,
          x.returnDebtCollected,
          x.cashRefunded,
          x.chargeRefunded,
          x.netCash,
          x.depositHeld,
          x.depositForfeited,
          x.pendingRefundAmount,
          x.pendingRefundCount,
          x.pendingChargeRefundAmount,
          x.pendingChargeRefundCount,
          x.unclassifiedCollectedPayments,
          x.unclassifiedDepositPayments,
          x.unsupportedCurrencyPayments,
        ]),
      );
    } else if (query.type === "utilization") {
      const report = await this.utilization(base, actor, true);
      if (report.total > MAX_SYNC_EXPORT_ROWS) throw new AppError(m.exportTooLarge, 422);
      body = csv(
        m.utilizationHeaders,
        report.items.map(({ facility, metrics: x }) => [
          report.asOf,
          facility.code,
          facility.name,
          x.totalUnits,
          x.activeUnits,
          x.occupiedUnits,
          x.availableUnits,
          x.maintenanceUnits,
          x.inactiveUnits,
          x.utilizationPercent,
          x.activeCheckoutHolds,
          x.confirmedAwaitingHandover,
        ]),
      );
    } else {
      const report = await this.rentals({ ...base, status: query.status }, actor);
      if (report.total > MAX_SYNC_EXPORT_ROWS) throw new AppError(m.exportTooLarge, 422);
      body = csv(
        m.rentalHeaders,
        report.items.map((x) => [
          report.asOf,
          x.id,
          x.bookingCode,
          x.facilityName,
          x.unitCode,
          x.unitTypeName,
          x.status,
          x.startAt,
          x.expectedEndAt,
        ]),
      );
    }
    return { body, filename: `reports-${query.type}.csv` };
  }
}
