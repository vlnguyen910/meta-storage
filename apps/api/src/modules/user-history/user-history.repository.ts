import type { LoginHistoryQuery, UserActivityLogQuery } from "@metastorage/contracts";
import {
  and,
  count,
  type Database,
  desc,
  eq,
  gte,
  loginHistory,
  lte,
  userActivityLogs,
} from "@metastorage/database";
import type { UserActivityInput } from "./user-activity.types";

export class UserHistoryRepository {
  constructor(private readonly db: Database) {}

  async recordActivity(event: UserActivityInput): Promise<void> {
    await this.db.insert(userActivityLogs).values(event);
  }

  async recordLogin(event: typeof loginHistory.$inferInsert): Promise<void> {
    await this.db
      .insert(loginHistory)
      .values(event)
      .onConflictDoNothing({ target: loginHistory.sessionId });
  }

  loginHistory(query: LoginHistoryQuery) {
    const filter = and(
      query.userId ? eq(loginHistory.userId, query.userId) : undefined,
      query.from ? gte(loginHistory.occurredAt, new Date(query.from)) : undefined,
      query.to ? lte(loginHistory.occurredAt, new Date(query.to)) : undefined,
    );
    return this.db.transaction(
      async (tx) => {
        const [total] = await tx.select({ value: count() }).from(loginHistory).where(filter);
        const items = await tx
          .select({
            id: loginHistory.id,
            userId: loginHistory.userId,
            occurredAt: loginHistory.occurredAt,
            device: loginHistory.device,
            operatingSystem: loginHistory.operatingSystem,
            browser: loginHistory.browser,
            model: loginHistory.model,
          })
          .from(loginHistory)
          .where(filter)
          .orderBy(desc(loginHistory.occurredAt), desc(loginHistory.id))
          .limit(query.limit)
          .offset(query.offset);
        return { items, total: total?.value ?? 0, limit: query.limit, offset: query.offset };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  activityLogs(query: UserActivityLogQuery) {
    const filter = and(
      query.actorId ? eq(userActivityLogs.actorId, query.actorId) : undefined,
      query.action ? eq(userActivityLogs.action, query.action) : undefined,
      query.entityType ? eq(userActivityLogs.entityType, query.entityType) : undefined,
      query.entityId ? eq(userActivityLogs.entityId, query.entityId) : undefined,
      query.facilityId ? eq(userActivityLogs.facilityId, query.facilityId) : undefined,
      query.from ? gte(userActivityLogs.occurredAt, new Date(query.from)) : undefined,
      query.to ? lte(userActivityLogs.occurredAt, new Date(query.to)) : undefined,
    );
    return this.db.transaction(
      async (tx) => {
        const [total] = await tx.select({ value: count() }).from(userActivityLogs).where(filter);
        const items = await tx
          .select({
            id: userActivityLogs.id,
            actorId: userActivityLogs.actorId,
            action: userActivityLogs.action,
            entityType: userActivityLogs.entityType,
            entityId: userActivityLogs.entityId,
            facilityId: userActivityLogs.facilityId,
            occurredAt: userActivityLogs.occurredAt,
          })
          .from(userActivityLogs)
          .where(filter)
          .orderBy(desc(userActivityLogs.occurredAt), desc(userActivityLogs.id))
          .limit(query.limit)
          .offset(query.offset);
        return { items, total: total?.value ?? 0, limit: query.limit, offset: query.offset };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
