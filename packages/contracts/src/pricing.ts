import { z } from "zod";
import { PRICING_MESSAGES as m } from "./pricing.messages";

export { PRICING_MESSAGES } from "./pricing.messages";
export type {
  PricingChange,
  PricingChangeValues,
  PricingConfiguration,
  PricingUpdateResult,
} from "./pricing.types";

export const PricingChangeOperation = {
  DEPOSIT_POLICY: "DEPOSIT_POLICY",
  UNIT_TYPE_PRICE: "UNIT_TYPE_PRICE",
} as const;

const version = z
  .number({ error: m.invalidVersion })
  .int(m.invalidVersion)
  .positive(m.invalidVersion)
  .max(2147483646, m.invalidVersion);
export const UpdateDepositPolicySchema = z.strictObject({
  expectedVersion: version,
  depositMonths: z
    .number({ error: m.invalidDeposit })
    .int(m.invalidDeposit)
    .positive(m.invalidDeposit)
    .max(2147483647, m.invalidDeposit),
});
export type UpdateDepositPolicy = z.infer<typeof UpdateDepositPolicySchema>;
export const UpdateUnitTypePriceSchema = z.strictObject({
  expectedVersion: version,
  monthlyPrice: z
    .number({ error: m.invalidPrice })
    .int(m.invalidPrice)
    .nonnegative(m.invalidPrice)
    .max(2147483647, m.invalidPrice),
});
export type UpdateUnitTypePrice = z.infer<typeof UpdateUnitTypePriceSchema>;
export const PricingUnitTypeParamsSchema = z.object({ unitTypeId: z.uuid() });
export const PricingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PricingQuery = z.infer<typeof PricingQuerySchema>;
