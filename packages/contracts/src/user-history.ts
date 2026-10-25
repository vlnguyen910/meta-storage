import { z } from "zod";
import { USER_HISTORY_MESSAGES } from "./user-history.messages";

const page = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
};
const orderedDates = (query: { from?: string; to?: string }) =>
  !query.from || !query.to || Date.parse(query.from) <= Date.parse(query.to);
const rangeError = { message: USER_HISTORY_MESSAGES.invalidDateRange, path: ["to"] };

export const LoginHistoryQuerySchema = z
  .strictObject({
    ...page,
    userId: z.uuid().optional(),
  })
  .refine(orderedDates, rangeError);

export const UserActivityLogQuerySchema = z
  .strictObject({
    ...page,
    actorId: z.uuid().optional(),
    action: z.string().trim().min(1).max(120).optional(),
    entityType: z.string().trim().min(1).max(80).optional(),
    entityId: z.string().trim().min(1).max(255).optional(),
    facilityId: z.uuid().optional(),
  })
  .refine(orderedDates, rangeError);

export type LoginHistoryQuery = z.infer<typeof LoginHistoryQuerySchema>;
export type UserActivityLogQuery = z.infer<typeof UserActivityLogQuerySchema>;
export type * from "./user-history.types";
