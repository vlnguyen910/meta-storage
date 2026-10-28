export interface PricingConfiguration {
  version: number;
  depositMonths: number;
  updatedAt: string;
  updatedBy: string | null;
  prices: {
    unitTypeId: string;
    facilityId: string;
    code: string;
    name: string;
    monthlyPrice: number;
    isActive: boolean;
  }[];
}

export type PricingChangeValues =
  | { depositMonths: number }
  | { unitTypeId: string; monthlyPrice: number }
  | { facilityId: string; unitTypeId: string; monthlyPrice: number | null };

export interface PricingChange {
  id: string;
  version: number;
  operation: "DEPOSIT_POLICY" | "UNIT_TYPE_PRICE";
  before: PricingChangeValues;
  after: PricingChangeValues;
  changedBy: string;
  user: {
    name: string;
  };
  changedAt: string;
}

export interface PricingUpdateResult {
  version: number;
}
