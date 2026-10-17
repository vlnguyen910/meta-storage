import { z } from "zod";

export const UserRole = {
  STORAGE_CUSTOMER: "CUSTOMER",
  FACILITY_STAFF: "FACILITY_STAFF",
  FACILITY_MANAGER: "FACILITY_MANAGER",
  BUSINESS_OPERATIONS_MANAGER: "BUSINESS_OPERATION_MANAGER",
  SYSTEM_ADMINISTRATOR: "SYSTEM_ADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const ROLES = Object.values(UserRole);
export const USER_STATUS = Object.values(UserStatus);

export const UserRoleSchema = z.enum(UserRole);
export const UserStatusSchema = z.enum(UserStatus);

export type { User } from "../../database/src/schema/users";

export const CreateUserInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(150),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().min(1).max(20).nullable().optional(),
  password: z.string().min(8).max(128),
  role: UserRoleSchema,
  status: UserStatusSchema,
  emailVerified: z.boolean(),
});
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

export const UserIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const UserListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const UpdateUserRoleInputSchema = z.strictObject({ role: UserRoleSchema });
export const UpdateUserStatusInputSchema = z.strictObject({ status: UserStatusSchema });
export const UpdateUserInputSchema = z
  .strictObject({ role: UserRoleSchema.optional(), status: UserStatusSchema.optional() })
  .refine((data) => data.role !== undefined || data.status !== undefined);
export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;
export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusInputSchema>;
