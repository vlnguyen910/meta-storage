import type {
  AcceptRenewal,
  QuoteRenewal,
  RenewalPageQuery,
  RentalRenewalDto,
} from "@metastorage/contracts/renewals";
import type { RenewalsRepository } from "./renewals.repository";
import type { RenewalRecord } from "./renewals.types";

export function renewalDto(row: RenewalRecord): RentalRenewalDto {
  return {
    id: row.id,
    rentalId: row.rentalId,
    rentalVersion: row.rentalVersion,
    chargeId: row.chargeId,
    paymentId: row.paymentId,
    status:
      ["QUOTED", "AWAITING_PAYMENT"].includes(row.status) && row.expiresAt < new Date()
        ? "EXPIRED"
        : row.status,
    months: row.months,
    oldEndAt: row.oldEndAt.toISOString(),
    newEndAt: row.newEndAt.toISOString(),
    monthlyRate: row.monthlyRate,
    amount: row.amount,
    currency: "VND",
    timezone: row.timezone,
    cutoffAt: row.cutoffAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    termsVersion: row.termsVersion,
    terms: row.terms,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    failureReason: row.failureReason,
    createdAt: row.createdAt.toISOString(),
  };
}

export class RenewalsService {
  constructor(private readonly repository: RenewalsRepository) {}
  async quote(rentalId: string, customerId: string, input: QuoteRenewal) {
    return renewalDto(await this.repository.quote(rentalId, customerId, input));
  }
  async accept(id: string, customerId: string, input: AcceptRenewal) {
    return renewalDto(await this.repository.accept(id, customerId, input.termsVersion));
  }
  async get(id: string, customerId: string) {
    return renewalDto(await this.repository.find(id, customerId));
  }
  async list(rentalId: string, customerId: string, query: RenewalPageQuery) {
    return (await this.repository.list(rentalId, customerId, query)).map(renewalDto);
  }
}
