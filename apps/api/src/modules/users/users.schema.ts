import { ROLES } from "@storex/database";
import { z } from "zod";

export const userIdParamsSchema = z.object({
  id: z.string().uuid("Invalid UUID format"),
});

export const userQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const updateUserRoleBodySchema = z.object({
  role: z.enum(ROLES),
});

export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type UserQueryParams = z.infer<typeof userQuerySchema>;
