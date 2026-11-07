import { z } from "zod";
import { HandoverChecklistItemResultSchema } from "./handover-checklist";
import { MOBILE_WORKFLOW_MESSAGES as m } from "./mobile-workflows.messages";

export const MobileRescheduleInputSchema = z.object({
  checkInAt: z.string().datetime({ offset: true }),
});
export const MobileRentalRequestInputSchema = z.object({
  type: z.enum(["RETURN", "CHANGE"]),
  reason: z.string().trim().min(1, m.reason).max(2000, m.reason),
  preferredAt: z.string().datetime({ offset: true }),
  targetUnitTypeId: z.string().uuid().optional(),
});
export const MobileInspectionInputSchema = z.object({
  version: z.number().int().nonnegative(),
  notes: z.string().trim().max(4000),
  checklist: z.array(HandoverChecklistItemResultSchema),
  photos: z.array(z.object({ id: z.string(), uri: z.string().max(2_000_000) })).max(8),
});
export const MobileReturnReportInputSchema = z.object({
  notes: z.string().trim().min(1, m.required).max(4000),
  checklist: z.array(HandoverChecklistItemResultSchema),
  photos: z.array(z.string().max(2_000_000)).max(8),
});
export type MobileRescheduleInput = z.infer<typeof MobileRescheduleInputSchema>;
export type MobileRentalRequestInput = z.infer<typeof MobileRentalRequestInputSchema>;
export type MobileInspectionInput = z.infer<typeof MobileInspectionInputSchema>;
export type MobileReturnReportInput = z.infer<typeof MobileReturnReportInputSchema>;
export type * from "./mobile-workflows.types";
