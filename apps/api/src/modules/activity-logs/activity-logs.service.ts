import { AsyncLocalStorage } from "node:async_hooks";
import {
  ActivityLogAction,
  type ActivityLogDto,
  ActivityLogEntityType,
  type ActivityLogQuery,
  ActivityLogQuerySchema,
  ActivityLogResult,
} from "@metastorage/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { mapPageDto } from "../../common/types/page.dto";
import type { ActivityLogsRepository } from "./activity-logs.repository";

export interface ActivityLog {
  occurredAt: Date;
  action: string;
  actorId: string | null;
  facilityId: string | null;
  entityType: string;
  entityId: string | null;
  description?: string;
  result?: ActivityLogResult;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  statusCode: number | null;
  sessionId?: string;
}

type ActivityAttempt = {
  action: ActivityLogAction;
  entityType: ActivityLogEntityType;
  entityId: string | null;
  description: string;
  facilityId?: string;
  changed: boolean;
  occurredAt: Date;
};
const activityContext = new AsyncLocalStorage<ActivityAttempt[]>();

// Services mark only important changes; outside an HTTP request there is no user activity to collect.
export function beginActivity(input: Omit<ActivityAttempt, "changed" | "occurredAt">) {
  const attempt = { ...input, changed: false, occurredAt: new Date() };
  activityContext.getStore()?.push(attempt);
  return attempt;
}

export class ActivityLogsService {
  private readonly pending = new WeakMap<FastifyRequest, ActivityAttempt[]>();

  constructor(
    private readonly repository: Pick<ActivityLogsRepository, "insert" | "ensureIndexes" | "list">,
  ) {}

  async initialize() {
    await this.repository.ensureIndexes();
  }

  startRequest(request: FastifyRequest, done: () => void) {
    const attempts: ActivityAttempt[] = [];
    this.pending.set(request, attempts);
    activityContext.run(attempts, done);
  }

  async recordRequest(request: FastifyRequest, reply: FastifyReply) {
    const attempts = this.pending.get(request) ?? [];
    this.pending.delete(request);
    if (!request.user || (reply.statusCode >= 300 && reply.statusCode < 400)) return;
    for (const attempt of attempts) {
      const failed = reply.statusCode >= 400;
      if (!failed && !attempt.changed) continue;
      await this.record(
        {
          occurredAt: attempt.occurredAt,
          action: attempt.action,
          actorId: request.user.id,
          facilityId: attempt.facilityId ?? request.facilityContext?.facilityId ?? null,
          entityType: attempt.entityType,
          entityId: attempt.entityId,
          description: attempt.description,
          result: failed ? ActivityLogResult.FAILURE : ActivityLogResult.SUCCESS,
          requestId: request.id,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"]?.slice(0, 512) ?? null,
          statusCode: reply.statusCode,
        },
        () => request.log.warn({ requestId: request.id }, "Activity log could not be stored"),
      );
    }
  }

  async recordLogin(
    session: {
      id: string;
      userId: string;
      createdAt: Date;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
    warn: () => void,
  ) {
    await this.record(
      {
        occurredAt: session.createdAt,
        action: ActivityLogAction.LOGIN,
        actorId: session.userId,
        facilityId: null,
        entityType: ActivityLogEntityType.USER,
        entityId: session.userId,
        description: "Signed in",
        result: ActivityLogResult.SUCCESS,
        requestId: null,
        ipAddress: session.ipAddress ?? null,
        userAgent: session.userAgent?.slice(0, 512) ?? null,
        statusCode: null,
        sessionId: session.id,
      },
      warn,
    );
  }

  async list(input: ActivityLogQuery) {
    const query = ActivityLogQuerySchema.parse(input);
    const page = await this.repository.list(query);
    return mapPageDto(
      page,
      query,
      (log): ActivityLogDto => ({
        id: log._id.toHexString(),
        userId: log.actorId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        description: log.description ?? log.action,
        // Legacy capture only stored accepted writes and created sessions.
        result: log.result ?? ActivityLogResult.SUCCESS,
        createdAt: log.occurredAt.toISOString(),
        ipAddress: log.ipAddress,
        facilityId: log.facilityId,
      }),
    );
  }

  private async record(event: ActivityLog, warn: () => void) {
    try {
      await this.repository.insert(event);
    } catch {
      // shortcut: outages can lose logs; add durable delivery if complete audit coverage is required.
      warn();
    }
  }
}
