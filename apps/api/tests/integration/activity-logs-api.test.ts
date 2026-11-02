import { afterAll, beforeAll, expect, spyOn, test } from "bun:test";
import { mongodb } from "@fastify/mongodb";
import { type ActivityLogQuery, ActivityLogResult } from "@metastorage/contracts";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { activityLogsRoutes } from "../../src/modules/activity-logs/activity-logs.routes";
import { ActivityLogsService } from "../../src/modules/activity-logs/activity-logs.service";
import { auth } from "../../src/modules/auth/auth";
import { authPlugin } from "../../src/modules/auth/auth.guard";

const userId = "b666c066-dbf7-40b4-9855-c34243a1f881";
const entityId = "8c12bcf7-f621-4e67-968e-6c0c8af90e21";
const queries: ActivityLogQuery[] = [];
const service = new ActivityLogsService({
  ensureIndexes: async () => {},
  insert: async () => {},
  list: async (query) => {
    queries.push(query);
    return {
      total: 1,
      items: [
        {
          _id: new mongodb.ObjectId("000000000000000000000001"),
          occurredAt: new Date("2026-11-02T00:00:00Z"),
          action: "UPDATE",
          actorId: userId,
          entityType: "USER",
          entityId,
          description: "Update user",
          result: ActivityLogResult.SUCCESS,
          facilityId: null,
          ipAddress: "127.0.0.1",
          requestId: "request",
          userAgent: "internal-client-metadata",
          sessionId: "internal-session-id",
          statusCode: 200,
        },
      ],
    };
  },
});
const app = Fastify();
const session = spyOn(auth.api, "getSession");
function authenticate(role: string | null, status = "ACTIVE") {
  session.mockResolvedValue(
    role
      ? ({ user: { id: userId, role, status }, session: { id: "session" } } as Awaited<
          ReturnType<typeof auth.api.getSession>
        >)
      : null,
  );
}
beforeAll(async () => {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  setupErrorHandler(app);
  app.register(authPlugin);
  app.register(activityLogsRoutes, { prefix: "/api/admin/activity-logs", service });
  await app.ready();
});
afterAll(async () => {
  session.mockRestore();
  await app.close();
});

test("only an active System Administrator can list all logs", async () => {
  for (const role of [
    null,
    "CUSTOMER",
    "FACILITY_STAFF",
    "FACILITY_MANAGER",
    "BUSINESS_OPERATION_MANAGER",
  ]) {
    authenticate(role);
    const before = queries.length;
    const response = await app.inject("/api/admin/activity-logs");
    expect(response.statusCode).toBe(role ? 403 : 401);
    expect(queries).toHaveLength(before);
  }
  authenticate("SYSTEM_ADMIN", "INACTIVE");
  expect((await app.inject("/api/admin/activity-logs")).statusCode).toBe(403);
  authenticate("SYSTEM_ADMIN");
  const response = await app.inject("/api/admin/activity-logs");
  expect(response.statusCode).toBe(200);
  expect(response.headers["cache-control"]).toBe("private, no-store");
  expect(response.json().data).toMatchObject({
    limit: 20,
    offset: 0,
    total: 1,
    items: [
      {
        id: "000000000000000000000001",
        userId,
        entityId,
        action: "UPDATE",
        entityType: "USER",
        description: "Update user",
        result: "SUCCESS",
        createdAt: "2026-11-02T00:00:00.000Z",
        ipAddress: "127.0.0.1",
      },
    ],
  });
  expect(response.body).not.toMatch(/internal-client-metadata|internal-session-id/);
});

test("list filters are validated and paginated before reaching the repository", async () => {
  authenticate("SYSTEM_ADMIN");
  const query = {
    userId,
    entityId,
    entityType: "USER",
    action: "UPDATE",
    result: "FAILURE",
    from: "2026-11-01T00:00:00Z",
    to: "2026-11-03T00:00:00Z",
    limit: "5",
    offset: "10",
  };
  const response = await app.inject(`/api/admin/activity-logs?${new URLSearchParams(query)}`);
  expect(response.statusCode).toBe(200);
  expect(queries.at(-1)).toEqual({ ...query, limit: 5, offset: 10 });
  const before = queries.length;
  for (const invalid of [
    "limit=101",
    "userId=invalid",
    "userId[$ne]=1",
    "result=other",
    "from=2026-11-03T00:00:00Z&to=2026-11-01T00:00:00Z",
  ]) {
    expect((await app.inject(`/api/admin/activity-logs?${invalid}`)).statusCode).toBe(400);
  }
  expect(queries).toHaveLength(before);
});

test("there are no endpoints to create, edit or delete logs, including for administrators", async () => {
  authenticate("SYSTEM_ADMIN");
  for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
    expect((await app.inject({ method, url: "/api/admin/activity-logs" })).statusCode).toBe(404);
    expect(
      (await app.inject({ method, url: "/api/admin/activity-logs/000000000000000000000001" }))
        .statusCode,
    ).toBe(404);
  }
});
