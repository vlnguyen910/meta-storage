import type { FacilityStatus } from "@metastorage/contracts";
import type { ReactNode } from "react";

export type OperationsSection =
  | "dashboard"
  | "facilities"
  | "pricing"
  | "fees"
  | "business-rules"
  | "reports"
  | "revenue"
  | "utilization";

export interface OperationsFacility {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly status: FacilityStatus;
  readonly total: number;
  readonly occupied: number;
  readonly available: number;
  readonly reserved: number;
  readonly maintenance: number;
  readonly rentalCollected: number;
  readonly depositHeld: number;
}

export interface OperationsPrice {
  readonly id: string;
  readonly name: string;
  readonly area: number;
  readonly monthlyPrice: number;
}

export interface OperationsMockData {
  readonly facilities: readonly OperationsFacility[];
  readonly prices: readonly OperationsPrice[];
}

export interface OperationsTotals {
  total: number;
  occupied: number;
  available: number;
  reserved: number;
  maintenance: number;
  rentalCollected: number;
  depositHeld: number;
  occupancy: number;
}

export interface OperationsWorkspaceProps {
  readonly section: OperationsSection;
}

export interface OperationsTableProps {
  readonly label: string;
  readonly headings: readonly string[];
  readonly children: ReactNode;
}

export interface OperationsMetricProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly detail?: string;
}

export interface OperationsDialogProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
}

export interface OperationsReportProps {
  readonly section: OperationsSection;
  readonly facilities: readonly OperationsFacility[];
  readonly totals: OperationsTotals;
  readonly unitTypeId: string;
}

export type OperationsTypeMetrics = Omit<OperationsTotals, "occupancy">;

export interface OperationsConfigurationProps {
  readonly section: OperationsSection;
  readonly prices: readonly OperationsPrice[];
  readonly onEditPrice: (price: OperationsPrice) => void;
}

export interface OperationsFacilityDraft {
  name: string;
  address: string;
}

export interface OperationsPriceDraft {
  monthlyPrice: number;
}

export interface OperationsFeeDraft {
  method: "unconfigured" | "fixed" | "percentage";
  value: string;
  extraCharge: string;
  damageCharge: string;
}
