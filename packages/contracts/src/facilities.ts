import { z } from "zod";
import { UserRole } from "./users";

export enum FacilityStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  MAINTENANCE = "MAINTENANCE",
}

export const FacilityAddressSchema = z.object({
  line1: z.string(),
  ward: z.string(),
  district: z.string(),
  city: z.string(),
});

export type FacilityAddress = z.infer<typeof FacilityAddressSchema>;

export const FacilitySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string(),
  address: FacilityAddressSchema,
  phone: z.string(),
  openingHours: z.string(),
  features: z.array(z.string()),
  status: z.nativeEnum(FacilityStatus),
  availableUnits: z.number().int().nonnegative(),
  totalUnits: z.number().int().positive(),
  startingMonthlyPrice: z.number().nonnegative(),
});

export type Facility = z.infer<typeof FacilitySchema>;

export type FacilitySummary = Facility;

export const FacilityAssignmentRoleSchema = z.enum(["FACILITY_STAFF", "FACILITY_MANAGER"]);

export type FacilityAssignmentRole = z.infer<typeof FacilityAssignmentRoleSchema>;

export const ApiFacilitySchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  address: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ApiFacility = z.infer<typeof ApiFacilitySchema>;

export const ApiFacilityAssignmentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  facilityId: z.string().uuid(),
  assignedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  isActive: z.boolean(),
  role: FacilityAssignmentRoleSchema,
  userName: z.string().optional(),
  userEmail: z.string().optional(),
  facilityName: z.string().optional(),
  facilityCode: z.string().optional(),
});

export type ApiFacilityAssignment = z.infer<typeof ApiFacilityAssignmentSchema>;

export const FacilityStaffMemberSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  role: z.literal(UserRole.FACILITY_STAFF),
  isActive: z.boolean(),
});

export type FacilityStaffMember = z.infer<typeof FacilityStaffMemberSchema>;

export type { FacilityListParams } from "./facilities.types";

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
  role: FacilityAssignmentRoleSchema,
});
export type CreateAssignmentBody = z.infer<typeof createAssignmentBodySchema>;
