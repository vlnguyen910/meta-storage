import { z } from "zod";

export const facilityIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type FacilityIdParam = z.infer<typeof facilityIdParamSchema>;

export const facilityIdNestedParamSchema = z.object({
  facilityId: z.string().uuid(),
});
export type FacilityIdNestedParam = z.infer<typeof facilityIdNestedParamSchema>;

export const facilityAssignmentParamSchema = z.object({
  facilityId: z.string().uuid(),
  userId: z.string().uuid(),
});
export type FacilityAssignmentParam = z.infer<typeof facilityAssignmentParamSchema>;

export const facilityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  isActive: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
});
export type FacilityQuery = z.infer<typeof facilityQuerySchema>;

export const createFacilityBodySchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(150),
  address: z.string().trim().min(1),
  description: z.string().trim().optional(),
  isActive: z.boolean().optional().default(true),
});
export type CreateFacilityBody = z.infer<typeof createFacilityBodySchema>;

export const updateFacilityBodySchema = z.object({
  code: z.string().trim().min(1).max(50).optional(),
  name: z.string().trim().min(1).max(150).optional(),
  address: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateFacilityBody = z.infer<typeof updateFacilityBodySchema>;

export const createAssignmentBodySchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["FACILITY_STAFF", "FACILITY_MANAGER"]),
});
export type CreateAssignmentBody = z.infer<typeof createAssignmentBodySchema>;
