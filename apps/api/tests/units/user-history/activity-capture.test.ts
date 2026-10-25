import { describe, expect, it } from "bun:test";
import Fastify from "fastify";
import { activityForResponse } from "../../../src/modules/user-history/user-activity";
import { userActivityPlugin } from "../../../src/modules/user-history/user-activity.plugin";

const actorId = "18500000-0000-4000-8000-000000000001";
const targetId = "18500000-0000-4000-8000-000000000002";

describe("user activity capture", () => {
  it("excludes reads, POST lookups/previews, auth and provider callbacks", () => {
    for (const [method, route] of [
      ["GET", "/api/users/me"],
      ["POST", "/api/check-ins/lookup"],
      ["POST", "/api/return-requests/:requestId/settlement/preview"],
      ["POST", "/api/auth/*"],
      ["POST", "/api/payments/webhooks/sepay"],
      ["POST", "/api/booking/magic-link/exchange"],
    ])
      expect(activityForResponse({ method, route, actorId })).toBeNull();
  });

  it("keeps only actor, route action and validated object identifiers", () => {
    const event = activityForResponse(
      {
        method: "PATCH",
        route: "/api/users/:id/status",
        actorId,
        params: { id: targetId, token: "private" },
        body: { password: "private", email: "private@example.test" },
      },
      { success: true, data: { id: targetId, passwordHash: "private" } },
    );
    expect(event).toEqual({
      actorId,
      action: "PATCH /api/users/:id/status",
      entityType: "users",
      entityId: targetId,
      facilityId: null,
    });
    expect(JSON.stringify(event)).not.toContain("private");
    expect(
      activityForResponse({ method: "PATCH", route: "/api/users/me/profile", actorId })?.entityId,
    ).toBe(actorId);
    expect(
      activityForResponse({ method: "POST", route: "/api/bookings/drafts", actorId: null })
        ?.entityId,
    ).toBeNull();
  });

  it("records every role after successful mutations, and never fails the response on log failure", async () => {
    const recorded: unknown[] = [];
    const app = Fastify();
    app.decorate("db", {
      insert: () => ({
        values: async (value: unknown) => {
          recorded.push(value);
          throw new Error("log unavailable");
        },
      }),
    } as never);
    app.decorateRequest("user", null);
    await app.register(userActivityPlugin);
    app.post("/api/tasks/:id", async (request) => {
      request.user = { id: actorId, role: request.headers["x-test-role"] } as never;
      return { success: true, data: { id: targetId } };
    });
    app.post("/api/tasks/:id/fail", async (_, reply) => reply.code(409).send({ success: false }));
    app.post("/api/tasks/:id/rejected", async () => ({ success: false }));
    app.delete("/api/tasks/:id", async (request, reply) => {
      request.user = { id: actorId } as never;
      return reply.code(204).send();
    });
    for (const role of [
      "CUSTOMER",
      "FACILITY_STAFF",
      "FACILITY_MANAGER",
      "BUSINESS_OPERATION_MANAGER",
      "SYSTEM_ADMIN",
    ]) {
      const response = await app.inject({
        method: "POST",
        url: `/api/tasks/${targetId}`,
        headers: { "x-test-role": role },
      });
      expect(response.statusCode).toBe(200);
    }
    await app.inject({ method: "POST", url: `/api/tasks/${targetId}/fail` });
    await app.inject({ method: "POST", url: `/api/tasks/${targetId}/rejected` });
    expect((await app.inject({ method: "DELETE", url: `/api/tasks/${targetId}` })).statusCode).toBe(
      204,
    );
    await app.close();
    expect(recorded).toHaveLength(6);
    expect(recorded[0]).toMatchObject({ actorId, entityId: targetId });
  });
});
