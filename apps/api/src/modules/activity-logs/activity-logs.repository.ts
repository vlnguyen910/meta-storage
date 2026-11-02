import type { mongodb } from "@fastify/mongodb";
import type { ActivityLogQuery } from "@metastorage/contracts";
import type { ActivityLog } from "./activity-logs.service";

export class ActivityLogsRepository {
  private readonly collection;

  constructor(database: mongodb.Db) {
    this.collection = database.collection<ActivityLog>("activity_logs");
  }

  async ensureIndexes() {
    await this.collection.createIndexes([
      { key: { occurredAt: -1, _id: -1 } },
      { key: { actorId: 1, occurredAt: -1 } },
      { key: { action: 1, occurredAt: -1 } },
      { key: { facilityId: 1, occurredAt: -1 } },
      { key: { entityType: 1, entityId: 1, occurredAt: -1 } },
    ]);
  }

  async insert(event: ActivityLog) {
    await this.collection.insertOne(event);
  }

  async list(query: ActivityLogQuery, actorIds?: string[]) {
    const filter: mongodb.Filter<ActivityLog> = {};
    if (actorIds)
      filter.actorId = {
        $in: query.userId ? actorIds.filter((id) => id === query.userId) : actorIds,
      };
    else if (query.userId) filter.actorId = query.userId;
    if (query.action) filter.action = query.action;
    if (query.entityType) filter.entityType = query.entityType;
    if (query.entityId) filter.entityId = query.entityId;
    if (query.result === "SUCCESS")
      filter.$or = [{ result: query.result }, { result: { $exists: false } }];
    else if (query.result) filter.result = query.result;
    if (query.from || query.to)
      filter.occurredAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    const [items, total] = await Promise.all([
      this.collection
        .find(filter)
        .sort({ occurredAt: -1, _id: -1 })
        .skip(query.offset)
        .limit(query.limit)
        .toArray(),
      this.collection.countDocuments(filter),
    ]);
    return { items, total };
  }
}
