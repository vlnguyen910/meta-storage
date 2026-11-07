import type {
  BookingDraft,
  PricingChange,
  PricingConfiguration,
  PricingQuery,
  PricingUpdateResult,
  UpdateDepositPolicy,
} from "@metastorage/contracts";
import { PRICING_MESSAGES as m } from "@metastorage/contracts";
import { AppError } from "../../common/errors/app-error";
import type { PricingRepository } from "./pricing.repository";

export class PricingService {
  constructor(private readonly repository: PricingRepository) {}

  async getConfiguration(query: PricingQuery): Promise<PricingConfiguration> {
    const configuration = await this.repository.getConfiguration(query);
    return { ...configuration, updatedAt: configuration.updatedAt.toISOString() };
  }

  updateDeposit(input: UpdateDepositPolicy, actor: string): Promise<PricingUpdateResult> {
    return this.repository.updateDeposit(input, actor);
  }

  async history(query: PricingQuery): Promise<PricingChange[]> {
    const rows = await this.repository.history(query);
    return rows.map((row) => ({ ...row, changedAt: row.changedAt.toISOString() }));
  }

  async quote(unitTypeId: string, durationMonths: number): Promise<BookingDraft["pricing"]> {
    const row = await this.repository.findQuote(unitTypeId);
    if (!row) throw new AppError(m.unavailable, 503, "PRICING_NOT_CONFIGURED");
    const price = BigInt(row.monthlyPrice);
    const rental = price * BigInt(durationMonths);
    const deposit = price * BigInt(row.depositMonths);
    const total = rental + deposit;
    // Existing booking/payment amounts are NUMERIC(14,2), with whole-VND prices.
    if (total > 999999999999n)
      throw new AppError(m.amountTooLarge, 422, "PRICING_AMOUNT_OUT_OF_RANGE");
    return {
      monthlyRateSnapshot: String(price),
      rentalFeeAmount: String(rental),
      depositAmount: String(deposit),
      totalAmount: String(total),
      currency: "VND",
    };
  }
}
