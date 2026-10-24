import { z } from "zod";
import { RENTAL_CHARGE_CONTRACT_MESSAGES as m } from "./rental-charges.messages";

export { RENTAL_CHARGE_CONTRACT_MESSAGES } from "./rental-charges.messages";
export type * from "./rental-charges.types";

export const RentalChargeSource = {
  EXTRA: "EXTRA",
  RETURN_DEBT: "RETURN_DEBT",
  RENEWAL: "RENEWAL",
} as const;
export type RentalChargeSource = (typeof RentalChargeSource)[keyof typeof RentalChargeSource];

export const RentalChargeCategory = {
  LOCK_REPLACEMENT: "LOCK_REPLACEMENT",
  KEY_REPLACEMENT: "KEY_REPLACEMENT",
  ACCESS_DEVICE_REPLACEMENT: "ACCESS_DEVICE_REPLACEMENT",
  FACILITY_SERVICE: "FACILITY_SERVICE",
  CLEANING: "CLEANING",
  RETURN_DEBT: "RETURN_DEBT",
  RENEWAL_RENT: "RENEWAL_RENT",
} as const;
export type RentalChargeCategory = (typeof RentalChargeCategory)[keyof typeof RentalChargeCategory];

export const RentalChargeStatus = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  OPEN: "OPEN",
  DISPUTED: "DISPUTED",
  PAID: "PAID",
  VOID: "VOID",
  REFUND_DUE: "REFUND_DUE",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
  REFUNDED: "REFUNDED",
} as const;
export type RentalChargeStatus = (typeof RentalChargeStatus)[keyof typeof RentalChargeStatus];

export const RentalChargeAdjustmentDirection = {
  INCREASE: "INCREASE",
  REDUCTION: "REDUCTION",
} as const;
export type RentalChargeAdjustmentDirection =
  (typeof RentalChargeAdjustmentDirection)[keyof typeof RentalChargeAdjustmentDirection];

export const RentalChargeEventType = {
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  DISPUTED: "DISPUTED",
  DISPUTE_UPHELD: "DISPUTE_UPHELD",
  DISPUTE_REDUCED: "DISPUTE_REDUCED",
  DISPUTE_WAIVED: "DISPUTE_WAIVED",
  ADJUSTED: "ADJUSTED",
  PAID: "PAID",
  REFUND_CREATED: "REFUND_CREATED",
  REFUND_CONFIRMED: "REFUND_CONFIRMED",
  REFUND_CANCELLED: "REFUND_CANCELLED",
  VOIDED: "VOIDED",
} as const;
export type RentalChargeEventType =
  (typeof RentalChargeEventType)[keyof typeof RentalChargeEventType];

export const RentalChargeRefundStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
} as const;
export type RentalChargeRefundStatus =
  (typeof RentalChargeRefundStatus)[keyof typeof RentalChargeRefundStatus];

const positiveAmount = z
  .number()
  .int(m.invalidMoney)
  .positive(m.invalidMoney)
  .max(2_147_483_647, m.invalidMoney);
const reason = z.string().trim().min(1, m.reasonRequired).max(2000);
const page = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
};

export const RentalChargeRentalParamsSchema = z.object({ rentalId: z.uuid() });
export const RentalChargeParamsSchema = z.object({ chargeId: z.uuid() });
export const RentalChargeRefundParamsSchema = z.object({ refundId: z.uuid() });
export const RentalChargePageQuerySchema = z.object(page);
export type RentalChargePageQuery = z.infer<typeof RentalChargePageQuerySchema>;
export const CreateRentalChargeSchema = z.strictObject({
  category: z.enum([
    RentalChargeCategory.LOCK_REPLACEMENT,
    RentalChargeCategory.KEY_REPLACEMENT,
    RentalChargeCategory.ACCESS_DEVICE_REPLACEMENT,
    RentalChargeCategory.FACILITY_SERVICE,
    RentalChargeCategory.CLEANING,
  ]),
  amount: positiveAmount,
  evidence: z.string().trim().min(1, m.evidenceRequired).max(4000),
  dueDate: z.iso.date(),
});
export type CreateRentalCharge = z.infer<typeof CreateRentalChargeSchema>;
export const RentalChargeDecisionSchema = z.strictObject({ reason });
export type RentalChargeDecision = z.infer<typeof RentalChargeDecisionSchema>;
export const RentalChargeAdjustmentSchema = z.strictObject({
  direction: z.enum(RentalChargeAdjustmentDirection),
  amount: positiveAmount,
  reason,
});
export type RentalChargeAdjustment = z.infer<typeof RentalChargeAdjustmentSchema>;
export const RentalChargeDisputeSchema = z.strictObject({ reason });
export type RentalChargeDispute = z.infer<typeof RentalChargeDisputeSchema>;
export const ResolveRentalChargeDisputeSchema = z
  .strictObject({
    outcome: z.enum(["UPHOLD", "REDUCE", "WAIVE"]),
    amount: positiveAmount.optional(),
    reason,
  })
  .refine(
    (input) => (input.outcome === "REDUCE") === (input.amount !== undefined),
    m.disputeResolutionAmount,
  );
export type ResolveRentalChargeDispute = z.infer<typeof ResolveRentalChargeDisputeSchema>;
export const StartRentalChargePaymentSchema = z.strictObject({
  idempotencyKey: z.string().trim().min(16).max(128),
});
export type StartRentalChargePayment = z.infer<typeof StartRentalChargePaymentSchema>;
export const ConfirmRentalChargeRefundSchema = z.strictObject({
  reference: z.string().trim().min(1).max(128),
});
export type ConfirmRentalChargeRefund = z.infer<typeof ConfirmRentalChargeRefundSchema>;
