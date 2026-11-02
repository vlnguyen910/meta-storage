import type { mongodb } from "@fastify/mongodb";
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
    ]);
  }

  async insert(event: ActivityLog) {
    await this.collection.insertOne(event);
  }
}
