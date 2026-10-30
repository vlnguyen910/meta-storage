import { z } from "zod";
import { FACILITY_WORKSPACE_MESSAGES as M } from "./facility-workspace.messages";
import { RentalStatusSchema } from "./rentals";
import { SUPPORT_CATEGORIES, SUPPORT_PRIORITIES, SUPPORT_STATUSES } from "./support";
export const FacilityWorkspaceQuerySchema = z
  .object({
    facilityId: z.string().uuid(),
    search: z.string().trim().max(200).optional(),
    status: RentalStatusSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().nonnegative().default(0),
  })
  .strict();
export const FacilitySupportQuerySchema = FacilityWorkspaceQuerySchema.extend({
  status: z.enum(SUPPORT_STATUSES).optional(),
  category: z.enum(SUPPORT_CATEGORIES).optional(),
  priority: z.enum(SUPPORT_PRIORITIES).optional(),
  overdue: z
    .preprocess(
      (value) => (value === "true" ? true : value === "false" ? false : value),
      z.boolean(),
    )
    .optional(),
});
const base = { version: z.number().int().nonnegative() };
const reason = z.string().trim().min(3, M.required).max(5000);
export const SupportOperationSchema = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("ASSIGN"), staffId: z.string().uuid(), reason }),
  z.object({ ...base, action: z.literal("REPLY"), content: reason }),
  z.object({ ...base, action: z.literal("NOTE"), content: reason }),
  z.object({ ...base, action: z.literal("REPORT"), content: reason }),
  z.object({ ...base, action: z.literal("START") }),
  z.object({ ...base, action: z.literal("ACCEPT"), reportId: z.string().uuid(), reason }),
  z.object({ ...base, action: z.literal("CLOSE"), reason }),
  z.object({ ...base, action: z.literal("REOPEN"), reason }),
  z.object({
    ...base,
    action: z.literal("PRIORITY"),
    priority: z.enum(SUPPORT_PRIORITIES),
    reason,
  }),
]);
export type FacilityWorkspaceQuery = z.infer<typeof FacilityWorkspaceQuerySchema>;
export type FacilitySupportQuery = z.infer<typeof FacilitySupportQuerySchema>;
export type SupportOperation = z.infer<typeof SupportOperationSchema>;
export * from "./facility-workspace.messages";
export type * from "./facility-workspace.types";
