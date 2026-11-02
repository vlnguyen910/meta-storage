import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mongodb } from "@fastify/mongodb";
import {
  ActivityLogAction,
  ActivityLogEntityType,
  ActivityLogResult,
} from "@metastorage/contracts";
import { ActivityLogsRepository } from "../../src/modules/activity-logs/activity-logs.repository";
import { ActivityLogsService } from "../../src/modules/activity-logs/activity-logs.service";

const uri = process.env.MONGODB_TEST_URI;
test.skipIf(!uri)("MongoDB persists login history independently of session deletion", async () => {
  if (!uri) throw new Error("MONGODB_TEST_URI is required");
  const url = new URL(uri);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Activity log integration tests require an explicit loopback MongoDB URL");
  }
  const databaseName = `metastorage_activity_logs_test_${randomUUID().replaceAll("-", "")}`;
  const client = new mongodb.MongoClient(uri, { serverSelectionTimeoutMS: 2000 });
  await client.connect();
  const database = client.db(databaseName);
  try {
    const repository = new ActivityLogsRepository(database);
    const service = new ActivityLogsService(repository);
    await service.initialize();
    // Index setup must be safe on every API restart.
    await service.initialize();
    const session = {
      id: randomUUID(),
      userId: randomUUID(),
      createdAt: new Date(),
      token: "secret",
    };
    await database.collection("sessions").insertOne(session);
    await service.recordLogin(session, () => {
      throw new Error("unexpected log failure");
    });
    await database.collection("sessions").deleteOne({ id: session.id });
    const stored = await database.collection("activity_logs").findOne({ sessionId: session.id });
    expect(stored?.action).toBe("LOGIN");
    expect(stored?.actorId).toBe(session.userId);
    expect(stored?.occurredAt).toEqual(session.createdAt);
    expect(stored).not.toHaveProperty("token");
    expect(await database.collection("activity_logs").indexes()).toHaveLength(6);
    await repository.insert({
      occurredAt: new Date(session.createdAt.getTime() + 1000),
      action: ActivityLogAction.UPDATE,
      actorId: session.userId,
      facilityId: null,
      entityType: ActivityLogEntityType.USER,
      entityId: session.userId,
      description: "Update user",
      result: ActivityLogResult.FAILURE,
      ipAddress: null,
      userAgent: null,
      requestId: "failed-request",
      statusCode: 409,
    });
    const failure = await service.list({
      limit: 1,
      offset: 0,
      userId: session.userId,
      result: ActivityLogResult.FAILURE,
      entityType: ActivityLogEntityType.USER,
      entityId: session.userId,
      from: session.createdAt.toISOString(),
      to: new Date(session.createdAt.getTime() + 2000).toISOString(),
    });
    expect(failure.total).toBe(1);
    expect(failure.items[0]).toMatchObject({
      userId: session.userId,
      action: "UPDATE",
      result: "FAILURE",
      description: "Update user",
    });
    expect(failure.items[0]).not.toHaveProperty("sessionId");
    const page = await service.list({ limit: 1, offset: 1 });
    expect(page.total).toBe(2);
    expect(page.items[0]?.action).toBe("LOGIN");
    // Previous activity documents have no description/result; retain readable history without a migration.
    await repository.insert({
      occurredAt: session.createdAt,
      action: "POST /api/users",
      actorId: session.userId,
      facilityId: null,
      entityType: "users",
      entityId: session.userId,
      ipAddress: null,
      userAgent: null,
      requestId: "legacy-request",
      statusCode: 201,
    });
    const successes = await service.list({
      limit: 20,
      offset: 0,
      result: ActivityLogResult.SUCCESS,
    });
    expect(successes.total).toBe(2);
    expect(successes.items.every((item) => item.result === ActivityLogResult.SUCCESS)).toBe(true);
  } finally {
    await database.dropDatabase();
    await client.close();
  }
});

test.skipIf(!uri || !process.env.MY_STORAGE_LOCAL_DATABASE_URL)(
  "auth session creation records one login that remains after logout",
  async () => {
    const { assertTestDatabase } = await import("../fixtures/test-database");
    assertTestDatabase(process.env.MY_STORAGE_LOCAL_DATABASE_URL);
    const mongoUrl = new URL(process.env.MONGODB_URI ?? "");
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(mongoUrl.hostname) ||
      !mongoUrl.pathname.includes("_test")
    )
      throw new Error("Auth activity tests require an isolated loopback MongoDB test database");

    const { db, users, accounts, sessions, eq, queryClient } = await import(
      "@metastorage/database"
    );
    const { hashPassword } = await import("better-auth/crypto");
    const { default: Fastify } = await import("fastify");
    const { mongoClient, mongoDatabase } = await import("../../src/common/database/mongo-plugin");
    const { authRoutes } = await import("../../src/modules/auth/auth.routes");
    const { authPlugin } = await import("../../src/modules/auth/auth.guard");
    const { activityLogsRoutes } = await import(
      "../../src/modules/activity-logs/activity-logs.routes"
    );
    const { usersRoutes } = await import("../../src/modules/users/users.routes");
    const { setupErrorHandler } = await import("../../src/common/errors/error-handler");
    const { serializerCompiler, validatorCompiler } = await import("fastify-type-provider-zod");
    const userId = randomUUID();
    const adminId = randomUUID();
    const email = `activity-${userId}@example.test`;
    const app = Fastify();
    const logs = mongoDatabase.collection("activity_logs");
    const activityLogs = new ActivityLogsService(new ActivityLogsRepository(mongoDatabase));
    let flushed = () => {};
    const cookies = (response: { headers: Record<string, unknown> }) => {
      const values = response.headers["set-cookie"];
      return (Array.isArray(values) ? values : [values])
        .map((value) => String(value).split(";")[0])
        .join("; ");
    };
    try {
      app.decorate("db", db);
      setupErrorHandler(app);
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);
      app.addHook("onRequest", (request, _reply, done) => activityLogs.startRequest(request, done));
      app.addHook("onResponse", async (request, reply) =>
        activityLogs.recordRequest(request, reply),
      );
      app.addHook("onResponse", async (request) => {
        if (request.method === "PATCH") flushed();
      });
      app.register(authPlugin);
      app.register(authRoutes, { prefix: "/api/auth" });
      app.register(usersRoutes, { prefix: "/api/users" });
      app.register(activityLogsRoutes, {
        prefix: "/api/admin/activity-logs",
        service: activityLogs,
      });
      await db.insert(users).values({
        id: userId,
        email,
        name: "Activity test",
        emailVerified: true,
        status: "ACTIVE",
        role: "CUSTOMER",
      });
      await db.insert(accounts).values({
        id: randomUUID(),
        userId,
        accountId: userId,
        providerId: "credential",
        password: await hashPassword("ActivityTestPassword123!"),
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: { origin: "http://localhost:3000", "x-forwarded-for": "198.51.100.7" },
        payload: { email, password: "ActivityTestPassword123!" },
      });
      expect(login.statusCode).toBe(200);
      const stored = await logs.findOne({ actorId: userId });
      const [session] = await db.select().from(sessions).where(eq(sessions.userId, userId));
      expect(stored?.action).toBe("LOGIN");
      expect(stored?.sessionId).toBe(session?.id);
      expect(stored?.ipAddress).toBe("127.0.0.1");
      expect(stored).not.toHaveProperty("token");
      const customerRead = await app.inject({
        url: "/api/admin/activity-logs",
        headers: { cookie: cookies(login) },
      });
      expect(customerRead.statusCode).toBe(403);
      await db.insert(users).values({
        id: adminId,
        email: `admin-${email}`,
        name: "Activity admin",
        emailVerified: true,
        status: "ACTIVE",
        role: "SYSTEM_ADMIN",
      });
      await db.insert(accounts).values({
        id: randomUUID(),
        userId: adminId,
        accountId: adminId,
        providerId: "credential",
        password: await hashPassword("ActivityTestPassword123!"),
      });
      const adminLogin = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: { origin: "http://localhost:3000" },
        payload: { email: `admin-${email}`, password: "ActivityTestPassword123!" },
      });
      expect(adminLogin.statusCode).toBe(200);
      const adminCookie = cookies(adminLogin);
      async function lockUser(target: string) {
        // Activity inserts happen after delivery; wait for the following response hook before reading MongoDB.
        const completed = new Promise<void>((resolve) => {
          flushed = resolve;
        });
        const response = await app.inject({
          method: "PATCH",
          url: `/api/users/${target}/status`,
          headers: { cookie: adminCookie },
          payload: { status: "INACTIVE" },
        });
        await completed;
        return response;
      }
      expect((await lockUser(userId)).statusCode).toBe(200);
      expect((await lockUser(userId)).statusCode).toBe(200);
      expect((await lockUser(adminId)).statusCode).toBe(403);
      const history = await app.inject({
        url: `/api/admin/activity-logs?userId=${adminId}&action=LOCK`,
        headers: { cookie: adminCookie },
      });
      expect(history.statusCode).toBe(200);
      expect(history.json().data.total).toBe(2);
      expect(
        history
          .json()
          .data.items.map((entry: { entityId: string; result: string }) => [
            entry.entityId,
            entry.result,
          ]),
      ).toEqual([
        [adminId, "FAILURE"],
        [userId, "SUCCESS"],
      ]);
      const cookieHeaders = login.headers["set-cookie"];
      const cookie = (Array.isArray(cookieHeaders) ? cookieHeaders : [cookieHeaders])
        .map((value) => String(value).split(";")[0])
        .join("; ");
      const logout = await app.inject({
        method: "POST",
        url: "/api/auth/sign-out",
        headers: { cookie, origin: "http://localhost:3000" },
      });
      expect(logout.statusCode).toBe(200);
      expect(await db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(0);
      expect(await logs.countDocuments({ actorId: userId, action: "LOGIN" })).toBe(1);
    } finally {
      await logs.deleteMany({ actorId: { $in: [userId, adminId] } });
      await db.delete(users).where(eq(users.id, userId));
      await db.delete(users).where(eq(users.id, adminId));
      await app.close();
      await queryClient.end();
      await mongoClient.close();
    }
  },
);
