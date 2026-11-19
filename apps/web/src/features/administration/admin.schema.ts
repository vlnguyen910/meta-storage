import { UserRole } from "@metastorage/database/schema/user-enums";
import { z } from "zod";
import { ADMIN_MESSAGES as M } from "./admin.messages";

export const AdminUserEditSchema = z.object({
  role: z
    .nativeEnum(UserRole)
    .refine(
      (role) => role !== UserRole.SYSTEM_ADMINISTRATOR && role !== UserRole.STORAGE_CUSTOMER,
      { message: M.invalidRoleChange },
    ),
});

export const AdminUserCreateSchema = z
  .object({
    name: z.string().trim().min(1, M.nameRequired).max(150),
    email: z.string().trim().toLowerCase().email(M.invalidEmail).max(255),
    phone: z.string().trim().max(20).optional().or(z.literal("")),
    role: z.enum(
      [UserRole.FACILITY_STAFF, UserRole.FACILITY_MANAGER, UserRole.BUSINESS_OPERATIONS_MANAGER],
      { errorMap: () => ({ message: M.roleRequired }) },
    ),
    password: z.string().min(8, M.passwordTooShort).max(128),
    confirmPassword: z.string().min(8, M.passwordTooShort).max(128),
  })
  .superRefine((input, ctx) => {
    if (input.password !== input.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: M.passwordsDoNotMatch,
      });
    }
  });

export type AdminUserCreateValues = z.infer<typeof AdminUserCreateSchema>;
