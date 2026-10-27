import type {
  RentalChargeCategory,
  RentalChargeSource,
  RentalChargeStatus,
} from "./rental-charges";

export type RentalChargeDto = {
  id: string;
  rentalId: string;
  source: RentalChargeSource;
  category: RentalChargeCategory;
  amount: string;
  adjustedAmount: string;
  paidAmount: string;
  refundedAmount: string;
  outstandingAmount: string;
  currency: string;
  evidence: string;
  dueDate: string | null;
  status: RentalChargeStatus;
  createdBy: string;
  approvedBy: string | null;
  decisionReason: string | null;
  disputedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RentalChargePage = {
  items: RentalChargeDto[];
  total: number;
  limit: number;
  offset: number;
};

export type RentalChargePaymentSession = {
  chargeId: string;
  paymentId: string;
  status: "PENDING";
  provider: "sepay";
  paymentCode: string;
  checkoutUrl: string;
  checkoutFormFields: Record<string, string | number>;
  expiresAt: string;
};

export type RentalChargeRefundDto = {
  id: string;
  chargeId: string;
  paymentId: string;
  amount: string;
  reason: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  reference: string | null;
  createdAt: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
};

export interface FacilityRentalChargeItem extends RentalChargeDto {
  capturedAmount: string;
  context: {
    facilityId: string;
    bookingId: string;
    bookingCode: string | null;
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    unitCode: string;
    rentalStatus: string;
    expectedEndAt: string;
  };
}

export interface FacilityRentalChargePage {
  items: FacilityRentalChargeItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface FacilityRentalChargeDetail extends FacilityRentalChargeItem {
  events: {
    id: string;
    type: string;
    actorId: string | null;
    reason: string | null;
    createdAt: string;
  }[];
  adjustments: {
    id: string;
    direction: "INCREASE" | "REDUCTION";
    amount: string;
    reason: string;
    createdBy: string;
    createdAt: string;
  }[];
  refunds: RentalChargeRefundDto[];
}
