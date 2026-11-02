import { expect, test } from "bun:test";
import Fastify from "fastify";
import { activityLogsPlugin } from "../../src/modules/activity-logs/activity-logs.plugin";
import {
  type ActivityLog,
  ActivityLogsService,
} from "../../src/modules/activity-logs/activity-logs.service";

const userId = "b666c066-dbf7-40b4-9855-c34243a1f881";
const facilityId = "bf7ab726-c0f9-47bd-bf00-15e09d8bb916";
const entityId = "8c12bcf7-f621-4e67-968e-6c0c8af90e21";

function capture() {
  const events: ActivityLog[] = [];
  const service = new ActivityLogsService({
    ensureIndexes: async () => {},
    insert: async (event) => {
      events.push(event);
    },
  });
  return { events, service };
}

test("login copies only safe session fields and survives removal of the session", async () => {
  const { events, service } = capture();
  const session = {
    id: "session-identifier",
    userId,
    createdAt: new Date("2026-11-02T00:00:00Z"),
    ipAddress: "127.0.0.1",
    userAgent: "a".repeat(600),
    token: "secret-token",
    expiresAt: new Date(),
  };
  await service.recordLogin(session, () => {
    throw new Error("unexpected warning");
  });
  delete (session as Partial<typeof session>).id;
  expect(events).toEqual([
    {
      occurredAt: session.createdAt,
      action: "LOGIN",
      actorId: userId,
      facilityId: null,
      entityType: "users",
      entityId: userId,
      requestId: null,
      ipAddress: "127.0.0.1",
      userAgent: "a".repeat(512),
      statusCode: null,
      sessionId: "session-identifier",
    },
  ]);
  expect(JSON.stringify(events)).not.toContain("secret-token");
});

test("MongoDB failure warns without rejecting login", async () => {
  let warnings = 0;
  const service = new ActivityLogsService({
    ensureIndexes: async () => {},
    insert: async () => {
      throw new Error("database unavailable");
    },
  });
  await service.recordLogin({ id: "session", userId, createdAt: new Date() }, () => {
    warnings++;
  });
  expect(warnings).toBe(1);
});

test("request capture keeps trusted context and UUIDs without payloads or query strings", async () => {
  const { events, service } = capture();
  const app = Fastify();
  app.register(activityLogsPlugin, { service });
  app.register(async (routes) => {
    routes.post("/api/facilities/:facilityId/units", async (request, reply) => {
      request.user = { id: userId } as typeof request.user;
      request.facilityContext = { facilityId } as typeof request.facilityContext;
      return reply
        .status(201)
        .send({ success: true, data: { id: entityId, token: "response-secret" } });
    });
    routes.patch("/api/units/:id", async (_request, reply) => reply.status(204).send());
    routes.get("/api/units", async () => ({ data: [] }));
    routes.post("/api/auth/sign-in/email", async (_request, reply) => reply.status(401).send());
    routes.post("/api/auth/sign-out", async () => ({ success: true }));
    routes.post("/api/units/rejected", async (_request, reply) => reply.status(403).send());
  });
  try {
    await app.inject({
      method: "POST",
      url: `/api/facilities/${facilityId}/units?token=query-secret`,
      headers: {
        "user-agent": "test-browser",
        "x-forwarded-for": "spoofed-ip",
        cookie: "cookie-secret",
      },
      payload: { password: "body-secret", facilityId: entityId },
    });
    await app.inject({ method: "PATCH", url: `/api/units/${entityId}` });
    await app.inject({ method: "GET", url: "/api/units" });
    await app.inject({ method: "POST", url: "/api/auth/sign-in/email" });
    await app.inject({ method: "POST", url: "/api/auth/sign-out" });
    await app.inject({ method: "POST", url: "/api/units/rejected" });
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      action: "POST /api/facilities/:facilityId/units",
      actorId: userId,
      facilityId,
      entityType: "facilities",
      entityId,
      ipAddress: "127.0.0.1",
      userAgent: "test-browser",
      statusCode: 201,
    });
    expect(events[0]?.requestId).toBeString();
    expect(events[1]).toMatchObject({ entityId, statusCode: 204, actorId: null });
    expect(JSON.stringify(events)).not.toMatch(/secret|spoofed-ip/);
  } finally {
    await app.close();
  }
});

test("a log write failure cannot change an accepted HTTP response", async () => {
  const service = new ActivityLogsService({
    ensureIndexes: async () => {},
    insert: async () => {
      throw new Error("database unavailable");
    },
  });
  const app = Fastify();
  app.register(activityLogsPlugin, { service });
  app.post("/api/units", async () => ({ success: true }));
  try {
    const response = await app.inject({ method: "POST", url: "/api/units" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
  } finally {
    await app.close();
  }
});
