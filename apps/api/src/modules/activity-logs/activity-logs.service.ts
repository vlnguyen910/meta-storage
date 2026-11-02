import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { ActivityLogsRepository } from "./activity-logs.repository";

export interface ActivityLog {
  occurredAt: Date;
  action: string;
  actorId: string | null;
  facilityId: string | null;
  entityType: string;
  entityId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  statusCode: number | null;
  sessionId?: string;
}

const uuid = z.uuid();
export function activityEntityId(value: unknown): string | null {
  const parsed = uuid.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export class ActivityLogsService {
  constructor(
    private readonly repository: Pick<ActivityLogsRepository, "insert" | "ensureIndexes">,
  ) {}

  async initialize() {
    await this.repository.ensureIndexes();
  }

  async recordRequest(request: FastifyRequest, reply: FastifyReply, entityId?: string) {
    const route = request.routeOptions.url ?? "";
    if (
      !["POST", "PUT", "PATCH", "DELETE"].includes(request.method) ||
      !route.startsWith("/api/") ||
      route.startsWith("/api/auth/") ||
      reply.statusCode < 200 ||
      reply.statusCode >= 300
    )
      return;

    const params = (request.params ?? {}) as Record<string, unknown>;
    const target = Object.entries(params).find(
      ([key, value]) => key !== "facilityId" && activityEntityId(value),
    );
    // shortcut: accepted writes include no-op/idempotent repeats; domain audits hold exact changes.
    await this.record(
      {
        occurredAt: new Date(),
        action: `${request.method} ${route}`,
        actorId: request.user?.id ?? null,
        facilityId: request.facilityContext?.facilityId ?? activityEntityId(params.facilityId),
        entityType: route.split("/")[2] ?? "unknown",
        entityId: entityId ?? activityEntityId(params.id) ?? activityEntityId(target?.[1]),
        requestId: request.id,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"]?.slice(0, 512) ?? null,
        statusCode: reply.statusCode,
      },
      () => request.log.warn({ requestId: request.id }, "Activity log could not be stored"),
    );
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
        action: "LOGIN",
        actorId: session.userId,
        facilityId: null,
        entityType: "users",
        entityId: session.userId,
        requestId: null,
        ipAddress: session.ipAddress ?? null,
        userAgent: session.userAgent?.slice(0, 512) ?? null,
        statusCode: null,
        sessionId: session.id,
      },
      warn,
    );
  }

  private async record(event: ActivityLog, warn: () => void) {
    try {
      await this.repository.insert(event);
    } catch {
      warn();
    }
  }
}
