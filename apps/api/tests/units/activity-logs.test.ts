import { expect, test } from "bun:test";
import {
  ActivityLogAction as Action,
  ActivityLogQuerySchema,
  ActivityLogEntityType as Entity,
} from "@metastorage/contracts";
import Fastify from "fastify";
import { ConflictError } from "../../src/common/errors/app-error";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import {
  type ActivityLog,
  ActivityLogsService,
  beginActivity,
} from "../../src/modules/activity-logs/activity-logs.service";
import type { AuthService } from "../../src/modules/auth/auth.service";
import type { UsersRepository } from "../../src/modules/users/users.repository";
import { UsersService } from "../../src/modules/users/users.service";

const userId = "b666c066-dbf7-40b4-9855-c34243a1f881";
const entityId = "8c12bcf7-f621-4e67-968e-6c0c8af90e21";
const facilityId = "bf7ab726-c0f9-47bd-bf00-15e09d8bb916";
function capture(fail = false) {
  const events: ActivityLog[] = [];
  const service = new ActivityLogsService({
    ensureIndexes: async () => {},
    list: async () => ({ items: [], total: 0 }),
    insert: async (event) => {
      if (fail) throw new Error("database unavailable");
      events.push(event);
    },
  });
  const app = Fastify();
  setupErrorHandler(app);
  app.addHook("onRequest", (request, _reply, done) => service.startRequest(request, done));
  app.addHook("onResponse", async (request, reply) => service.recordRequest(request, reply));
  return { events, service, app };
}

test("login copies only safe session fields", async () => {
  const { events, service, app } = capture();
  try {
    const session = {
      id: "session-identifier",
      userId,
      createdAt: new Date(),
      token: "secret-token",
      userAgent: "a".repeat(600),
    };
    await service.recordLogin(session, () => {
      throw new Error("unexpected warning");
    });
    expect(events[0]).toMatchObject({
      action: "LOGIN",
      entityType: "USER",
      actorId: userId,
      sessionId: session.id,
      description: "Signed in",
      result: "SUCCESS",
      userAgent: "a".repeat(512),
    });
    expect(JSON.stringify(events)).not.toContain("secret-token");
  } finally {
    await app.close();
  }
});

test("MongoDB failure warns without rejecting login", async () => {
  const { service, app } = capture(true);
  let warnings = 0;
  try {
    await service.recordLogin({ id: "session", userId, createdAt: new Date() }, () => {
      warnings++;
    });
    expect(warnings).toBe(1);
  } finally {
    await app.close();
  }
});

test("only explicit important changes are logged, with success/failure and server identity", async () => {
  const { events, app } = capture();
  app.post<{ Body: { changed?: boolean; fail?: boolean; anonymous?: boolean } }>(
    "/important",
    async (request) => {
      if (!request.body.anonymous) request.user = { id: userId } as typeof request.user;
      const activity = beginActivity({
        action: Action.UPDATE,
        entityType: Entity.USER,
        entityId,
        facilityId,
        description: "Update user",
      });
      if (request.body.fail) throw new ConflictError("secret failure details");
      activity.changed = Boolean(request.body.changed);
      return { success: true, data: { token: "response-secret" } };
    },
  );
  app.post("/ordinary-crud", async () => ({ success: true }));
  app.get("/read", async () => ({ data: [] }));
  try {
    await app.inject({
      method: "POST",
      url: "/important?token=query-secret",
      headers: {
        "user-agent": "test-browser",
        "x-forwarded-for": "spoofed-ip",
        cookie: "cookie-secret",
      },
      payload: { changed: true, userId: entityId, password: "body-secret" },
    });
    await app.inject({ method: "POST", url: "/important", payload: { fail: true } });
    await app.inject({ method: "POST", url: "/important", payload: { changed: false } });
    await app.inject({
      method: "POST",
      url: "/important",
      payload: { changed: true, anonymous: true },
    });
    await app.inject({ method: "POST", url: "/ordinary-crud" });
    await app.inject("/read");
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      action: "UPDATE",
      actorId: userId,
      entityId,
      facilityId,
      entityType: "USER",
      result: "SUCCESS",
      ipAddress: "127.0.0.1",
      userAgent: "test-browser",
      statusCode: 200,
    });
    expect(events[1]).toMatchObject({
      result: "FAILURE",
      statusCode: 409,
      description: "Update user",
    });
    expect(JSON.stringify(events)).not.toMatch(/secret|spoofed-ip/);
  } finally {
    await app.close();
  }
});

test("concurrent requests keep separate actors and entities", async () => {
  const { events, app } = capture();
  app.post<{ Params: { id: string } }>("/:id", async (request) => {
    request.user = { id: request.params.id } as typeof request.user;
    const activity = beginActivity({
      action: Action.UPDATE,
      entityType: Entity.USER,
      entityId: request.params.id,
      description: "Update user",
    });
    await new Promise((resolve) => setTimeout(resolve, request.params.id === userId ? 10 : 1));
    activity.changed = true;
    return { success: true };
  });
  try {
    await Promise.all([
      app.inject({ method: "POST", url: `/${userId}` }),
      app.inject({ method: "POST", url: `/${entityId}` }),
    ]);
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.actorId === event.entityId)).toBe(true);
    expect(new Set(events.map((event) => event.actorId)).size).toBe(2);
  } finally {
    await app.close();
  }
});

test("user service logs actual role/status changes, skips no-ops, and records blocked locking", async () => {
  const { events, app } = capture();
  const current = {
    id: entityId,
    name: "Staff",
    email: "staff@example.test",
    emailVerified: true,
    phone: null,
    image: null,
    role: "FACILITY_STAFF",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let blocked = false;
  const users = new UsersService(
    {
      transaction: async (work: (tx: object) => Promise<unknown>) => work({}),
      findByIdForUpdate: async () => ({ ...current }),
      hasOpenWork: async () => blocked,
      update: async (_id: string, data: object) => Object.assign(current, data),
      deactivateAssignments: async () => {},
      revokeSessions: async () => {},
    } as unknown as UsersRepository,
    {} as AuthService,
  );
  app.patch<{
    Body: { role?: "FACILITY_STAFF" | "FACILITY_MANAGER"; status?: "ACTIVE" | "INACTIVE" };
  }>("/user", async (request) => {
    request.user = { id: userId } as typeof request.user;
    return users.updateUser(entityId, request.body);
  });
  try {
    await app.inject({
      method: "PATCH",
      url: "/user",
      payload: { role: "FACILITY_STAFF", status: "ACTIVE" },
    });
    expect(events).toHaveLength(0);
    await app.inject({ method: "PATCH", url: "/user", payload: { role: "FACILITY_MANAGER" } });
    await app.inject({ method: "PATCH", url: "/user", payload: { status: "INACTIVE" } });
    await app.inject({ method: "PATCH", url: "/user", payload: { status: "ACTIVE" } });
    blocked = true;
    const failed = await app.inject({
      method: "PATCH",
      url: "/user",
      payload: { status: "INACTIVE" },
    });
    expect(failed.statusCode).toBe(409);
    expect(events.map(({ action, result }) => [action, result])).toEqual([
      ["CHANGE_ROLE", "SUCCESS"],
      ["LOCK", "SUCCESS"],
      ["UNLOCK", "SUCCESS"],
      ["LOCK", "FAILURE"],
    ]);
  } finally {
    await app.close();
  }
});

test("an enclosing failed workflow cannot produce a successful activity", async () => {
  const { events, app } = capture();
  app.post("/transaction", async (request) => {
    request.user = { id: userId } as typeof request.user;
    beginActivity({
      action: Action.ASSIGN_UNIT,
      entityType: Entity.UNIT,
      entityId,
      description: "Assign unit",
    }).changed = true;
    throw new ConflictError("rollback");
  });
  try {
    await app.inject({ method: "POST", url: "/transaction" });
    expect(events).toHaveLength(1);
    expect(events[0]?.result).toBe("FAILURE");
  } finally {
    await app.close();
  }
});

test("own profile updates skip unchanged and omitted fields", async () => {
  const { events, app } = capture();
  const current = {
    id: userId,
    name: "Staff",
    email: "staff@example.test",
    emailVerified: true,
    phone: null,
    image: null,
    role: "CUSTOMER",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const users = new UsersService(
    {
      findById: async () => ({ ...current }),
      updateProfile: async (_id: string, data: { name?: string; phone?: string | null }) => ({
        ...current,
        ...data,
        name: data.name ?? current.name,
      }),
    } as unknown as UsersRepository,
    {} as AuthService,
  );
  app.patch<{ Body: { change: boolean } }>("/profile", async (request) => {
    request.user = { id: userId } as typeof request.user;
    return users.updateOwnProfile(userId, {
      name: request.body.change ? "Updated" : undefined,
      phone: null,
    });
  });
  try {
    await app.inject({ method: "PATCH", url: "/profile", payload: { change: false } });
    expect(events).toHaveLength(0);
    await app.inject({ method: "PATCH", url: "/profile", payload: { change: true } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: "UPDATE", entityId: userId, result: "SUCCESS" });
    expect(JSON.stringify(events)).not.toContain("Updated");
  } finally {
    await app.close();
  }
});

test("log write failure cannot change an accepted HTTP response", async () => {
  const { app } = capture(true);
  app.post("/important", async (request) => {
    request.user = { id: userId } as typeof request.user;
    beginActivity({
      action: Action.UPDATE,
      entityType: Entity.USER,
      entityId,
      description: "Update user",
    }).changed = true;
    return { success: true };
  });
  try {
    const response = await app.inject({ method: "POST", url: "/important" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
  } finally {
    await app.close();
  }
});

test("log filters reject invalid pagination, dates, IDs, and Mongo operators", () => {
  for (const query of [
    { limit: 101 },
    { offset: -1 },
    { userId: "invalid" },
    { result: "other" },
    { from: "2026-11-02T00:00:00Z", to: "2026-11-01T00:00:00Z" },
    { userId: { $ne: null } },
    { $where: "anything" },
  ]) {
    expect(ActivityLogQuerySchema.safeParse(query).success).toBe(false);
  }
});
