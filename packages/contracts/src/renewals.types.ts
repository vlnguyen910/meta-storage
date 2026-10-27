import type { RenewalStatus } from "./renewals";

export interface RentalRenewalDto {
  id: string;
  rentalId: string;
  rentalVersion: number;
  chargeId: string | null;
  paymentId: string | null;
  status: RenewalStatus;
  months: number;
  oldEndAt: string;
  newEndAt: string;
  monthlyRate: string;
  amount: string;
  currency: "VND";
  timezone: string;
  cutoffAt: string;
  expiresAt: string;
  termsVersion: string;
  terms: string;
  acceptedAt: string | null;
  appliedAt: string | null;
  failureReason: string | null;
  createdAt: string;
}
