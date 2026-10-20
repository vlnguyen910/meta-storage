import {
  ConfirmManualRefundInputSchema,
  UpdateDepositPolicySchema,
  UpdateUnitTypePriceSchema,
} from "@metastorage/contracts";
import { z } from "zod";
import { OPERATIONS_MESSAGES as M } from "./operations.messages";
import { REPORTING_MESSAGES as R } from "./operations-reporting.messages";

export const OperationsFacilityDraftSchema = z.object({
  name: z.string().trim().min(1, M.required),
  address: z.string().trim().min(1, M.required),
});

export const OperationsPriceDraftSchema = z
  .object({ monthlyPrice: z.number({ invalid_type_error: M.nonnegative }) })
  .superRefine((value, ctx) => {
    const result = UpdateUnitTypePriceSchema.safeParse({ ...value, expectedVersion: 1 });
    if (!result.success)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monthlyPrice"],
        message: R.priceInteger,
      });
  });
export type OperationsPriceDraft = z.infer<typeof OperationsPriceDraftSchema>;
export const OperationsDepositDraftSchema = z
  .object({ depositMonths: z.number({ invalid_type_error: M.required }) })
  .superRefine((value, ctx) => {
    const result = UpdateDepositPolicySchema.safeParse({ ...value, expectedVersion: 1 });
    if (!result.success)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["depositMonths"],
        message: R.depositInteger,
      });
  });
export type OperationsDepositDraft = z.infer<typeof OperationsDepositDraftSchema>;
export const OperationsManualRefundDraftSchema = z
  .object({ reference: z.string().trim() })
  .superRefine((value, ctx) => {
    if (!ConfirmManualRefundInputSchema.safeParse(value).success)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reference"],
        message: value.reference ? R.referenceLimit : M.required,
      });
  });
export type OperationsManualRefundDraft = z.infer<typeof OperationsManualRefundDraftSchema>;

export const OperationsFeeDraftSchema = z
  .object({
    method: z.enum(["unconfigured", "fixed", "percentage"]),
    value: z.string(),
    extraCharge: z.string(),
    damageCharge: z.string(),
  })
  .superRefine((values, context) => {
    for (const name of ["value", "extraCharge", "damageCharge"] as const) {
      if (
        values[name].trim() &&
        (!Number.isFinite(Number(values[name])) || Number(values[name]) < 0)
      ) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: M.nonnegative });
      }
    }
    if (values.method !== "unconfigured" && !values.value.trim()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: M.incomplete });
    }
    if (values.method === "percentage" && Number(values.value) > 100) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: M.percentage });
    }
  });
