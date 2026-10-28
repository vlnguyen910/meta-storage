export interface PricingConfiguration {
  version: number;
  depositMonths: number;
  updatedAt: string;
  updatedBy: string | null;
  prices: {
    unitTypeId: string;
    facilityId: string;
    priceRangeId: string;
    code: string;
    name: string;
    monthlyPrice: number;
    isActive: boolean;
  }[];
}

import type { PricingChangeValues } from "@metastorage/database/schema-domain";

export type { PricingChangeValues } from "@metastorage/database/schema-domain";

export interface PricingChange {
  id: string;
  version: number;
  operation: "DEPOSIT_POLICY" | "UNIT_TYPE_PRICE" | "RENTAL_PRICE_RANGE";
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

export interface RentalPriceRangeDto {
  id: string;
  code: string;
  name: string;
  minMonthlyPrice: number | null;
  maxMonthlyPrice: number | null;
  isActive: boolean;
  version: number;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
