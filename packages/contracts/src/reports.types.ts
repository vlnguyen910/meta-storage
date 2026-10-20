export interface ReportFacility {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}
export interface ReportFinancialMetrics {
  cashReceived: string;
  rentalCollected: string | null;
  depositCollected: string | null;
  cashRefunded: string;
  netCash: string;
  depositHeld: string | null;
  depositForfeited: string;
  pendingRefundAmount: string;
  pendingRefundCount: number;
  paymentsReceivedCount: number;
  unclassifiedCollectedPayments: number;
  unclassifiedDepositPayments: number;
  unsupportedCurrencyPayments: number;
}
export interface ReportInventoryMetrics {
  totalUnits: number;
  activeUnits: number;
  occupiedUnits: number;
  availableUnits: number;
  maintenanceUnits: number;
  reservedUnits: number;
  inspectionUnits: number;
  returnPendingUnits: number;
  lockedUnits: number;
  inactiveUnits: number;
  utilizationPercent: number | null;
  activeCheckoutHolds: number;
  confirmedAwaitingHandover: number;
}
export interface ReportPeriod {
  from: string;
  to: string;
  timeZone: "Asia/Ho_Chi_Minh";
}
export interface RevenueReport {
  period: ReportPeriod;
  asOf: string;
  currency: "VND";
  summary: ReportFinancialMetrics;
  items: { facility: ReportFacility; metrics: ReportFinancialMetrics }[];
  unattributed: ReportFinancialMetrics | null;
  total: number;
  limit: number;
  offset: number;
}
export interface MonthlyRevenuePoint {
  month: string;
  cashReceived: string;
  rentalCollected: string | null;
  depositCollected: string | null;
  cashRefunded: string;
  netCash: string;
  unsupportedCurrencyPayments: number;
}
export interface MonthlyRevenueReport {
  period: ReportPeriod;
  asOf: string;
  currency: "VND";
  items: MonthlyRevenuePoint[];
}
export interface UtilizationReport {
  asOf: string;
  summary: ReportInventoryMetrics;
  items: { facility: ReportFacility; metrics: ReportInventoryMetrics }[];
  total: number;
  limit: number;
  offset: number;
}
export interface RentalReportItem {
  id: string;
  bookingCode: string | null;
  facilityId: string;
  facilityName: string;
  unitCode: string;
  unitTypeName: string;
  status: string;
  startAt: string;
  expectedEndAt: string;
}
export interface RentalReport {
  asOf: string;
  items: RentalReportItem[];
  byStatus: { status: string; count: number }[];
  total: number;
  limit: number;
  offset: number;
}
export interface OperationsOverview {
  period: ReportPeriod;
  asOf: string;
  currency: "VND";
  summary: { financial: ReportFinancialMetrics; inventory: ReportInventoryMetrics };
  attention: {
    refunds: {
      count: number;
      amount: string;
      canManage: boolean;
      endpoint: string | null;
      description: string;
    };
    returnRefunds?: { count: number; amount: string; description: string };
    vacantCapacity: { count: number; description: string };
    maintenance: { count: number; description: string };
    dataQuality: {
      endpoint: string;
      hasIssues: boolean;
      unclassifiedCollectedPayments: number;
      unclassifiedDepositPayments: number;
      unsupportedCurrencyPayments: number;
      description: string;
    };
  };
  facilities: {
    facility: ReportFacility;
    financial: ReportFinancialMetrics;
    inventory: ReportInventoryMetrics;
  }[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReconciliationReport {
  asOf: string;
  items: {
    paymentId: string;
    bookingId: string | null;
    facilityId: string | null;
    currency: string;
    totalAmount: string;
    status: string;
    paidAt: string | null;
    missingSnapshot: boolean;
    unclassifiedDeposit: boolean;
    unsupportedCurrency: boolean;
  }[];
  total: number;
  limit: number;
  offset: number;
}
