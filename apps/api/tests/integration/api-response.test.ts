import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import Fastify from "fastify";
import { validatorCompiler } from "fastify-type-provider-zod";
import { z } from "zod";
import { AppError } from "../../src/common/errors/app-error";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { auth } from "../../src/modules/auth/auth";
import { authRoutes } from "../../src/modules/auth/auth.routes";

const app = Fastify();
const provider = spyOn(auth, "handler");

beforeAll(async () => {
  app.decorate("db", {});
  app.setValidatorCompiler(validatorCompiler);
  setupErrorHandler(app);
  app.get<{ Params: { status: string } }>("/domain/:status", async (request) => {
    throw new AppError("Domain failure", Number(request.params.status), "LEGACY_DOMAIN_CODE");
  });
  app.get("/unexpected", async () => {
    throw new Error("Unexpected failure");
  });
  app.post("/validation", { schema: { body: z.object({ name: z.string() }) } }, async () => ({}));
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.ready();
});

afterAll(async () => {
  provider.mockRestore();
  await app.close();
});

describe("HTTP error response contract", () => {
  test.each([400, 401, 403, 404, 409, 422, 500])(
    "uses HTTP status %s as error.code",
    async (status) => {
      const response = await app.inject(`/domain/${status}`);
      expect(response.statusCode).toBe(status);
      expect(response.json()).toEqual({
        success: false,
        error: { code: status, message: "Domain failure" },
        timestamp: expect.any(String),
      });
    },
  );
  test("preserves validation details with numeric code", async () => {
    const response = await app.inject({ method: "POST", url: "/validation", payload: {} });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      success: false,
      error: { code: 400, details: [{ field: "name", message: expect.any(String) }] },
    });
  });
  test("preserves Fastify's malformed JSON status", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/validation",
      headers: { "content-type": "application/json" },
      payload: "{",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe(400);
  });
  test("normalizes an unregistered route and an unexpected error", async () => {
    for (const [url, status] of [
      ["/missing", 404],
      ["/unexpected", 500],
    ] as const) {
      const response = await app.inject(url);
      expect(response.statusCode).toBe(status);
      expect(response.json()).toMatchObject({ success: false, error: { code: status } });
    }
  });
  test("normalizes Better Auth errors and preserves response headers", async () => {
    provider.mockResolvedValueOnce(
      Response.json(
        { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid credentials" },
        { status: 401, headers: { "set-cookie": "test=; Max-Age=0", "content-length": "1" } },
      ),
    );
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email: "test@example.test", password: "bad" },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      success: false,
      error: { code: 401, message: "Invalid credentials" },
      timestamp: expect.any(String),
    });
    expect(response.headers["set-cookie"]).toEqual(["test=; Max-Age=0"]);
    expect(response.headers["content-length"]).toBe(String(Buffer.byteLength(response.body)));
  });
  test("keeps the successful Better Auth response compatible with its client", async () => {
    const body = { user: { id: "account-id" }, token: "session-token" };
    provider.mockResolvedValueOnce(Response.json(body));
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(body);
  });
});
