import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  accounts,
  db,
  eq,
  queryClient,
  sessions,
  users,
  verifications,
} from "@metastorage/database";
import { hashPassword } from "better-auth/crypto";
import Fastify from "fastify";
import { ResendMailer } from "../../src/common/adapters/mailer/resend.adapter";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { authRoutes } from "../../src/modules/auth/auth.routes";
import { assertTestDatabase } from "../fixtures/test-database";

const target = process.env.MY_STORAGE_LOCAL_DATABASE_URL;
const id = randomUUID();
const email = `reset-${id}@example.test`;
const app = Fastify();
const oldPassword = "OldPassword123!";
const newPassword = "NewPassword123!";
const delivered: string[] = [];
let mail: ReturnType<typeof spyOn>;
const request = (path: string, payload?: object) =>
  app.inject({
    method: payload ? "POST" : "GET",
    url: `/api/auth${path}`,
    headers: { origin: "http://localhost:3000" },
    ...(payload ? { payload } : {}),
  });
async function resetToken() {
  const response = await request("/request-password-reset", { email });
  expect(response.statusCode).toBe(200);
  const deliveredUrl = delivered.at(-1);
  assert(deliveredUrl);
  const link = new URL(deliveredUrl);
  expect(link.searchParams.get("callbackURL")).toBe("http://localhost:3000/reset-password");
  const redirect = await app.inject({ url: `${link.pathname}${link.search}` });
  expect(redirect.statusCode).toBe(302);
  const token = new URL(String(redirect.headers.location)).searchParams.get("token");
  assert(token);
  return token;
}

describe.skipIf(!target)("password recovery through Better Auth and PostgreSQL", () => {
  beforeAll(async () => {
    assertTestDatabase(target);
    mail = spyOn(ResendMailer.prototype, "sendPasswordResetEmail").mockImplementation(
      async (input) => {
        expect(input.to).toBe(email);
        delivered.push(input.resetUrl);
      },
    );
    app.decorate("db", db);
    setupErrorHandler(app);
    await app.register(authRoutes, { prefix: "/api/auth" });
    await app.ready();
    await db.insert(users).values({
      id,
      email,
      name: "Recovery test",
      emailVerified: true,
      status: "ACTIVE",
      role: "CUSTOMER",
    });
    await db.insert(accounts).values({
      id: randomUUID(),
      userId: id,
      accountId: id,
      providerId: "credential",
      password: await hashPassword(oldPassword),
    });
  });
  afterAll(async () => {
    mail?.mockRestore();
    await db.delete(verifications).where(eq(verifications.value, id));
    await db.delete(users).where(eq(users.id, id));
    await app.close();
    await queryClient.end();
  });

  test("returns the same response for unknown email and fixes the web callback", async () => {
    const known = await request("/request-password-reset", { email });
    const count = delivered.length;
    const unknown = await request("/request-password-reset", {
      email: `missing-${id}@example.test`,
    });
    expect(unknown.statusCode).toBe(known.statusCode);
    expect(unknown.json()).toEqual(known.json());
    expect(delivered).toHaveLength(count);
    const response = await request("/request-password-reset", {
      email,
      redirectTo: "http://localhost:3000/login",
    });
    expect(response.statusCode).toBe(200);
    const deliveredUrl = delivered.at(-1);
    assert(deliveredUrl);
    expect(new URL(deliveredUrl).searchParams.get("callbackURL")).toBe(
      "http://localhost:3000/reset-password",
    );
  });
  test("enforces signup password lengths before consuming a token", async () => {
    const token = await resetToken();
    const [row] = await db
      .select()
      .from(verifications)
      .where(eq(verifications.identifier, `reset-password:${token}`));
    assert(row);
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(59 * 60_000);
    expect(row.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(60 * 60_000);
    for (const password of ["short", "a".repeat(129)]) {
      expect((await request("/reset-password", { token, newPassword: password })).statusCode).toBe(
        400,
      );
    }
    expect(
      await db
        .select()
        .from(verifications)
        .where(eq(verifications.identifier, `reset-password:${token}`)),
    ).toHaveLength(1);
  });
  test("rejects expired and unknown tokens", async () => {
    const token = await resetToken();
    await db
      .update(verifications)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(verifications.identifier, `reset-password:${token}`));
    for (const value of [token, "missing-token"]) {
      const response = await request("/reset-password", { token: value, newPassword });
      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe("INVALID_TOKEN");
    }
  });
  test("changes the password once, revokes old sessions and does not sign in", async () => {
    expect((await request("/sign-in/email", { email, password: oldPassword })).statusCode).toBe(
      200,
    );
    expect(await db.select().from(sessions).where(eq(sessions.userId, id))).toHaveLength(1);
    const token = await resetToken();
    const response = await request("/reset-password", { token, newPassword });
    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(await db.select().from(sessions).where(eq(sessions.userId, id))).toHaveLength(0);
    expect(
      (await request("/reset-password", { token, newPassword: "Different123!" })).statusCode,
    ).toBe(400);
    expect((await request("/sign-in/email", { email, password: oldPassword })).statusCode).toBe(
      401,
    );
    expect((await request("/sign-in/email", { email, password: newPassword })).statusCode).toBe(
      200,
    );
  });
});
