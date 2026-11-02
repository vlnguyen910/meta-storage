import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mongodb } from "@fastify/mongodb";
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
    const service = new ActivityLogsService(new ActivityLogsRepository(database));
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
    expect(await database.collection("activity_logs").indexes()).toHaveLength(5);
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
    const userId = randomUUID();
    const email = `activity-${userId}@example.test`;
    const app = Fastify();
    const logs = mongoDatabase.collection("activity_logs");
    try {
      app.decorate("db", db);
      app.register(authRoutes, { prefix: "/api/auth" });
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
      await logs.deleteMany({ actorId: userId });
      await db.delete(users).where(eq(users.id, userId));
      await app.close();
      await queryClient.end();
      await mongoClient.close();
    }
  },
);
