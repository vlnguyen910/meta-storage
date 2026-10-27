import type { userActivityLogs } from "@metastorage/database";

export interface ActivityRequest {
  method: string;
  route: string;
  actorId: string | null;
  params?: unknown;
  body?: unknown;
}

export type UserActivityInput = typeof userActivityLogs.$inferInsert;
