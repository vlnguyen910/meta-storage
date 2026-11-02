import { z } from "zod";
import { UserListQuerySchema } from "./users";

export enum ActivityLogAction {
  LOGIN = "LOGIN",
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  LOCK = "LOCK",
  UNLOCK = "UNLOCK",
  ASSIGN_ROLE = "ASSIGN_ROLE",
  CHANGE_ROLE = "CHANGE_ROLE",
  ASSIGN_FACILITY = "ASSIGN_FACILITY",
  REVOKE_FACILITY = "REVOKE_FACILITY",
  ASSIGN_UNIT = "ASSIGN_UNIT",
  CHANGE_STATUS = "CHANGE_STATUS",
  RECORD_RESULT = "RECORD_RESULT",
  RESOLVE = "RESOLVE",
}

export enum ActivityLogEntityType {
  USER = "USER",
  FACILITY = "FACILITY",
  UNIT = "UNIT",
  RENTAL = "RENTAL",
  PAYMENT = "PAYMENT",
  INSPECTION = "INSPECTION",
  SUPPORT = "SUPPORT",
}

export enum ActivityLogResult {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
}

export const ActivityLogQuerySchema = UserListQuerySchema.pick({ limit: true, offset: true })
  .extend({
    userId: z.uuid().optional(),
    action: z.enum(ActivityLogAction).optional(),
    entityType: z.enum(ActivityLogEntityType).optional(),
    entityId: z.uuid().optional(),
    result: z.enum(ActivityLogResult).optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .refine((query) => !query.from || !query.to || Date.parse(query.from) <= Date.parse(query.to));

export type ActivityLogQuery = z.infer<typeof ActivityLogQuerySchema>;

export const ActivityLogSchema = z.object({
  id: z.string(),
  userId: z.uuid().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  description: z.string(),
  result: z.enum(ActivityLogResult),
  createdAt: z.iso.datetime(),
  ipAddress: z.string().nullable(),
  facilityId: z.uuid().nullable(),
});
export type ActivityLogDto = z.infer<typeof ActivityLogSchema>;

export const ActivityLogPageSchema = z.object({
  items: z.array(ActivityLogSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
