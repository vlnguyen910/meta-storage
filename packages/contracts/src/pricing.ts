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
  UNIT_TYPE_PRICE_RANGE: "UNIT_TYPE_PRICE_RANGE",
} as const;

export const PriceRangeIdParamsSchema = z.object({ id: z.uuid() });
const priceBound = z.number().int().positive().max(2147483647).nullable();
const rangeBounds = (value: { minMonthlyPrice?: number | null; maxMonthlyPrice?: number | null }) =>
  value.minMonthlyPrice === undefined ||
  value.maxMonthlyPrice === undefined ||
  (value.minMonthlyPrice === null && value.maxMonthlyPrice === null) ||
  (value.minMonthlyPrice !== null &&
    value.maxMonthlyPrice !== null &&
    value.maxMonthlyPrice >= value.minMonthlyPrice);

export const CreatePriceRangeSchema = z
  .strictObject({
    code: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(100),
    minMonthlyPrice: priceBound,
    maxMonthlyPrice: priceBound,
    isActive: z.boolean().optional().default(true),
  })
  .refine(rangeBounds, { message: m.rangeBoundsInvalid });
export type CreatePriceRange = z.infer<typeof CreatePriceRangeSchema>;

export const UpdatePriceRangeSchema = z
  .strictObject({
    expectedVersion: z.number().int().nonnegative().max(2147483646),
    code: z.string().trim().min(1).max(80).optional(),
    name: z.string().trim().min(1).max(100).optional(),
    minMonthlyPrice: priceBound.optional(),
    maxMonthlyPrice: priceBound.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).some((key) => key !== "expectedVersion"), {
    message: m.rangeBoundsInvalid,
  })
  .refine(rangeBounds, { message: m.rangeBoundsInvalid });
export type UpdatePriceRange = z.infer<typeof UpdatePriceRangeSchema>;

export const SetUnitTypePriceRangeSchema = z.strictObject({
  priceRangeId: z.uuid(),
  expectedVersion: z.number().int().nonnegative().max(2147483646),
});
export type SetUnitTypePriceRange = z.infer<typeof SetUnitTypePriceRangeSchema>;

export const UnitTypePriceRangeAssignmentSchema = z.object({
  unitTypeId: z.uuid(),
  priceRangeId: z.uuid(),
  version: z.number().int().nonnegative(),
});
export type UnitTypePriceRangeAssignment = z.infer<typeof UnitTypePriceRangeAssignmentSchema>;

export const PriceRangeSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  minMonthlyPrice: z.number().int().positive().nullable(),
  maxMonthlyPrice: z.number().int().positive().nullable(),
  isActive: z.boolean(),
  version: z.number().int().nonnegative(),
  updatedBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PriceRange = z.infer<typeof PriceRangeSchema>;

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
  expectedVersion: z.number().int().nonnegative().max(2147483646),
  monthlyPrice: z
    .number({ error: m.invalidPrice })
    .int(m.invalidPrice)
    .positive(m.invalidPrice)
    .max(2147483647, m.invalidPrice),
});
export type UpdateUnitTypePrice = z.infer<typeof UpdateUnitTypePriceSchema>;
export const PricingUnitTypeParamsSchema = z.object({ unitTypeId: z.uuid() });
export const PricingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PricingQuery = z.infer<typeof PricingQuerySchema>;
