import { z } from "zod";
import { USER_INPUT_MESSAGES } from "./users.messages";

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
export const BusinessUserRoleSchema = UserRoleSchema.exclude(["SYSTEM_ADMINISTRATOR"]);
export const UserStatusSchema = z.enum(UserStatus);

export type { CustomerRegistrationMonth, CustomerRegistrationStats, User } from "./users.types";

export const CustomerRegistrationQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});
export type CustomerRegistrationQuery = z.infer<typeof CustomerRegistrationQuerySchema>;

export const UpdateOwnProfileInputSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(150).optional(),
    phone: z.string().trim().min(1).max(20).nullable().optional(),
  })
  .refine((data) => data.name !== undefined || data.phone !== undefined, {
    message: USER_INPUT_MESSAGES.profileChangeRequired,
  });
export type UpdateOwnProfileInput = z.infer<typeof UpdateOwnProfileInputSchema>;

export const CreateUserInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(150),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().min(1).max(20).nullable().optional(),
  password: z.string().min(8).max(128),
  role: BusinessUserRoleSchema,
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
  search: z.string().trim().max(150).optional(),
  role: UserRoleSchema.optional(),
  status: UserStatusSchema.optional(),
});
export type UserListQuery = z.infer<typeof UserListQuerySchema>;

export const UpdateUserRoleInputSchema = z.strictObject({ role: BusinessUserRoleSchema });
export const UpdateUserStatusInputSchema = z.strictObject({ status: UserStatusSchema });
export const UpdateUserInputSchema = z
  .strictObject({ role: UserRoleSchema.optional(), status: UserStatusSchema.optional() })
  .refine((data) => data.role !== undefined || data.status !== undefined);
export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;
export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusInputSchema>;
