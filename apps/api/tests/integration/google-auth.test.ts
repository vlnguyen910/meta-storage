import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  accounts,
  db,
  eq,
  inArray,
  queryClient,
  sessions,
  users,
  verifications,
} from "@metastorage/database";
import { APIError } from "better-auth/api";
import { hashPassword } from "better-auth/crypto";
import Fastify from "fastify";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { auth } from "../../src/modules/auth/auth";
import { authPlugin } from "../../src/modules/auth/auth.guard";
import { authRoutes } from "../../src/modules/auth/auth.routes";

const target = process.env.MY_STORAGE_LOCAL_DATABASE_URL;
const suffix = randomUUID();
const origin = "http://localhost:3000";
const app = Fastify();
const createdIds: string[] = [];
const stateKeys: string[] = [];
const spies: Array<{ mockRestore(): void }> = [];
const profiles = new Map<string, { sub: string; email: string; emailVerified: boolean }>();
const email = (label: string) => `google-${label}-${suffix}@example.test`;
const cookies = (response: { headers: Record<string, unknown> }) => {
  const value = response.headers["set-cookie"];
  return (Array.isArray(value) ? value : value ? [value] : [])
    .map((item) => String(item).split(";")[0])
    .join("; ");
};
async function passwordUser(label: string, status: "ACTIVE" | "INACTIVE" = "ACTIVE") {
  const id = randomUUID();
  createdIds.push(id);
  await db.insert(users).values({
    id,
    name: "Existing Manager",
    email: email(label),
    emailVerified: true,
    role: "FACILITY_MANAGER",
    status,
  });
  await db.insert(accounts).values({
    id: randomUUID(),
    userId: id,
    accountId: id,
    providerId: "credential",
    password: await hashPassword("GoogleTestPassword123!"),
  });
  return id;
}
async function request(path: string, payload?: object, cookie = "") {
  return app.inject({
    method: payload ? "POST" : "GET",
    url: `/api/auth${path}`,
    headers: { origin, cookie },
    ...(payload ? { payload } : {}),
  });
}
async function start(label: string, cookie = "", link = false) {
  const response = await request(
    link ? "/link-social" : "/sign-in/social",
    {
      provider: "google",
      callbackURL: `${origin}/done`,
      errorCallbackURL: `${origin}/error`,
      disableRedirect: true,
    },
    cookie,
  );
  expect(response.statusCode).toBe(200);
  const url = new URL(response.json().url);
  const state = url.searchParams.get("state") as string;
  stateKeys.push(state);
  profiles.set(label, { sub: label, email: email(label), emailVerified: true });
  return { state, cookie: [cookie, cookies(response)].filter(Boolean).join("; ") };
}
async function callback(code: string, flow: { state: string; cookie: string }) {
  return request(
    `/callback/google?code=${encodeURIComponent(code)}&state=${encodeURIComponent(flow.state)}`,
    undefined,
    flow.cookie,
  );
}

describe.skipIf(!target)("Google OAuth using local PostgreSQL and mocked Google exchange", () => {
  beforeAll(async () => {
    const url = new URL(target as string);
    if (
      process.env.NODE_ENV !== "test" ||
      process.env.DATABASE_URL !== target ||
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      url.port !== "5433" ||
      url.pathname !== "/metastorage"
    )
      throw new Error("Explicit existing local database only");
    app.decorate("db", db);
    setupErrorHandler(app);
    app.register(authPlugin);
    app.register(authRoutes, { prefix: "/api/auth" });
    await app.ready();
    const context = await auth.$context;
    const provider = context.socialProviders.find((p) => p.id === "google");
    if (!provider) throw new Error("Tests require Google test credentials");
    spies.push(
      spyOn(provider, "validateAuthorizationCode").mockImplementation(async ({ code }) => ({
        accessToken: code,
        scopes: ["openid", "email", "profile"],
      })),
    );
    spies.push(
      spyOn(provider, "getUserInfo").mockImplementation(async (tokens) => {
        const profile = profiles.get(tokens.accessToken ?? "");
        if (!profile) return null;
        return {
          user: {
            name: "Google Profile",
            email: profile.email,
            emailVerified: profile.emailVerified,
          },
          data: { sub: profile.sub },
        };
      }),
    );
  });

  afterAll(async () => {
    for (const spy of spies) spy.mockRestore();
    const oauthUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(
        inArray(
          users.email,
          [...profiles.values()].map((p) => p.email),
        ),
      );
    const ids = [...new Set([...createdIds, ...oauthUsers.map((u) => u.id)])];
    if (ids.length) await db.delete(users).where(inArray(users.id, ids));
    if (stateKeys.length)
      await db.delete(verifications).where(inArray(verifications.identifier, stateKeys));
    await app.close();
    await queryClient.end();
  });

  test("new Google user becomes verified CUSTOMER/ACTIVE; replay cannot create another account", async () => {
    const flow = await start("new");
    const response = await callback("new", flow);
    expect(response.headers.location).toBe(`${origin}/done`);
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email("new")));
    expect(user).toMatchObject({ role: "CUSTOMER", status: "ACTIVE", emailVerified: true });
    if (!user) throw new Error("Google user was not persisted");
    expect(cookies(response)).toContain("session_token");
    const replay = await callback("new", flow);
    expect(replay.headers.location).toContain("error=");
    expect(await db.select().from(accounts).where(eq(accounts.userId, user.id))).toHaveLength(1);
  });

  test("failed Google account creation rolls back the user and permits a fresh signup", async () => {
    const context = await auth.$context;
    const failure = spyOn(context.internalAdapter, "createAccount").mockImplementationOnce(
      async () => {
        throw new APIError("BAD_REQUEST", {
          code: "TEST_ACCOUNT_INSERT_FAILED",
          message: "Simulated account insert failure",
        });
      },
    );
    try {
      const response = await callback("rollback", await start("rollback"));
      expect(response.headers.location).toContain("TEST_ACCOUNT_INSERT_FAILED");
      expect(cookies(response)).not.toContain("session_token=");
      expect(
        await db
          .select()
          .from(users)
          .where(eq(users.email, email("rollback"))),
      ).toHaveLength(0);
      expect(
        await db.select().from(accounts).where(eq(accounts.accountId, "rollback")),
      ).toHaveLength(0);
    } finally {
      failure.mockRestore();
    }
    const retry = await callback("rollback", await start("rollback"));
    expect(retry.headers.location).toBe(`${origin}/done`);
    expect(cookies(retry)).toContain("session_token=");
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email("rollback")));
    expect(user).toMatchObject({ role: "CUSTOMER", status: "ACTIVE" });
    if (!user) throw new Error("Google retry user missing");
    expect(await db.select().from(accounts).where(eq(accounts.userId, user.id))).toHaveLength(1);
  });

  test("provider account conflicts inside a transaction remain controlled and roll back the user", async () => {
    const owner = await passwordUser("transaction-owner");
    const subject = `transaction-conflict-${suffix}`;
    await db.insert(accounts).values({
      id: randomUUID(),
      userId: owner,
      providerId: "google",
      accountId: subject,
    });
    const id = randomUUID();
    createdIds.push(id);
    const context = await auth.$context;
    await expect(
      context.adapter.transaction(async (transaction) => {
        await transaction.create({
          model: "user",
          forceAllowId: true,
          data: {
            id,
            name: "Transaction rollback",
            email: email("transaction-rollback"),
            emailVerified: true,
            role: "CUSTOMER",
            status: "ACTIVE",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        await transaction.create({
          model: "account",
          forceAllowId: true,
          data: {
            id: randomUUID(),
            userId: id,
            providerId: "google",
            accountId: subject,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }),
    ).rejects.toMatchObject({ status: "CONFLICT", body: { code: "ACCOUNT_ALREADY_LINKED" } });
    expect(await db.select().from(users).where(eq(users.id, id))).toHaveLength(0);
    expect(await db.select().from(accounts).where(eq(accounts.accountId, subject))).toMatchObject([
      { userId: owner },
    ]);
  });

  test("existing email cannot implicitly link, password login and explicit linking preserve role", async () => {
    const id = await passwordUser("manager");
    const blocked = await callback("manager", await start("manager"));
    expect(blocked.headers.location).toContain("account_not_linked");
    expect(await db.select().from(accounts).where(eq(accounts.userId, id))).toHaveLength(1);
    const login = await request("/sign-in/email", {
      email: email("manager"),
      password: "GoogleTestPassword123!",
    });
    expect(login.statusCode).toBe(200);
    const linked = await callback("manager", await start("manager", cookies(login), true));
    expect(linked.headers.location).toBe(`${origin}/done`);
    const second = await callback("manager", await start("manager"));
    expect(second.headers.location).toBe(`${origin}/done`);
    const [user] = await db.select().from(users).where(eq(users.id, id));
    expect(user).toMatchObject({
      role: "FACILITY_MANAGER",
      status: "ACTIVE",
      name: "Existing Manager",
    });
    expect(await db.select().from(accounts).where(eq(accounts.userId, id))).toHaveLength(2);
  });

  test("linking requires a live ACTIVE session at initiation and callback", async () => {
    expect((await request("/link-social", { provider: "google" })).statusCode).toBe(401);
    const id = await passwordUser("expired");
    const login = await request("/sign-in/email", {
      email: email("expired"),
      password: "GoogleTestPassword123!",
    });
    const flow = await start("expired", cookies(login), true);
    await db.delete(sessions).where(eq(sessions.userId, id));
    expect((await callback("expired", flow)).headers.location).toContain("error=");
    expect(await db.select().from(accounts).where(eq(accounts.userId, id))).toHaveLength(1);
  });

  test("wrong-email and unverified Google identities cannot link or register", async () => {
    const id = await passwordUser("wrong");
    const login = await request("/sign-in/email", {
      email: email("wrong"),
      password: "GoogleTestPassword123!",
    });
    const flow = await start("wrong", cookies(login), true);
    profiles.set("wrong", { sub: "wrong", email: email("different"), emailVerified: true });
    expect((await callback("wrong", flow)).headers.location).toContain("error=");
    expect(await db.select().from(accounts).where(eq(accounts.userId, id))).toHaveLength(1);
    const unverified = await start("unverified");
    profiles.set("unverified", {
      sub: "unverified",
      email: email("unverified"),
      emailVerified: false,
    });
    expect((await callback("unverified", unverified)).headers.location).toContain("error=");
    expect(
      await db
        .select()
        .from(users)
        .where(eq(users.email, email("unverified"))),
    ).toHaveLength(0);
  });

  test("inactive accounts cannot acquire Google sessions or link", async () => {
    const id = await passwordUser("inactive");
    const login = await request("/sign-in/email", {
      email: email("inactive"),
      password: "GoogleTestPassword123!",
    });
    await db.update(users).set({ status: "INACTIVE" }).where(eq(users.id, id));
    expect((await request("/link-social", { provider: "google" }, cookies(login))).statusCode).toBe(
      403,
    );
    await db
      .insert(accounts)
      .values({ id: randomUUID(), userId: id, providerId: "google", accountId: "inactive" });
    const response = await callback("inactive", await start("inactive"));
    expect(response.headers.location).toContain("error=");
    expect(cookies(response)).not.toContain("session_token=");
  });

  test("untrusted callback, tampered state and cancellation fail closed", async () => {
    expect(
      (await request("/sign-in/social", { provider: "google", callbackURL: "https://evil.test" }))
        .statusCode,
    ).toBe(403);
    const flow = await start("tampered");
    expect(
      (await callback("tampered", { ...flow, state: `${flow.state}-invalid` })).headers.location,
    ).toContain("error=");
    const cancelled = await start("cancelled");
    expect(
      (
        await request(
          `/callback/google?error=access_denied&state=${cancelled.state}`,
          undefined,
          cancelled.cookie,
        )
      ).headers.location,
    ).toContain("access_denied");
  });

  test("concurrent repeated linking creates one provider account", async () => {
    const id = await passwordUser("concurrent");
    const login = await request("/sign-in/email", {
      email: email("concurrent"),
      password: "GoogleTestPassword123!",
    });
    const flows = await Promise.all([
      start("concurrent", cookies(login), true),
      start("concurrent", cookies(login), true),
    ]);
    const responses = await Promise.all(flows.map((flow) => callback("concurrent", flow)));
    for (const response of responses) {
      expect(response.statusCode).toBeLessThan(500);
      expect(response.body).not.toContain("insert into");
    }
    expect(await db.select().from(accounts).where(eq(accounts.userId, id))).toHaveLength(2);
  });

  test("expired OAuth state and an account owned by another user cannot link", async () => {
    const expired = await start("expired-state");
    const [state] = await db
      .select()
      .from(verifications)
      .where(eq(verifications.identifier, expired.state));
    if (!state) throw new Error("OAuth state missing");
    await db
      .update(verifications)
      .set({
        value: JSON.stringify({ ...JSON.parse(state.value), expiresAt: Date.now() - 1000 }),
      })
      .where(eq(verifications.id, state.id));
    expect((await callback("expired-state", expired)).headers.location).toContain("error=");
    expect(
      await db
        .select()
        .from(users)
        .where(eq(users.email, email("expired-state"))),
    ).toHaveLength(0);

    const owner = await passwordUser("owner");
    const claimant = await passwordUser("claimant");
    const subject = `owned-${suffix}`;
    await db
      .insert(accounts)
      .values({ id: randomUUID(), userId: owner, providerId: "google", accountId: subject });
    const login = await request("/sign-in/email", {
      email: email("claimant"),
      password: "GoogleTestPassword123!",
    });
    const flow = await start("claimant", cookies(login), true);
    profiles.set("claimant", { sub: subject, email: email("claimant"), emailVerified: true });
    expect((await callback("claimant", flow)).headers.location).toContain("error=");
    expect(await db.select().from(accounts).where(eq(accounts.userId, claimant))).toHaveLength(1);
    expect(await db.select().from(accounts).where(eq(accounts.accountId, subject))).toMatchObject([
      { userId: owner },
    ]);
  });

  test("disabling an account during linking blocks callback and password login", async () => {
    const id = await passwordUser("disabled-during-link");
    const login = await request("/sign-in/email", {
      email: email("disabled-during-link"),
      password: "GoogleTestPassword123!",
    });
    const flow = await start("disabled-during-link", cookies(login), true);
    await db.update(users).set({ status: "INACTIVE" }).where(eq(users.id, id));
    expect((await callback("disabled-during-link", flow)).headers.location).toContain(
      "account_disabled",
    );
    expect(await db.select().from(accounts).where(eq(accounts.userId, id))).toHaveLength(1);
    expect((await request("/me", undefined, cookies(login))).statusCode).toBe(403);
    expect(
      (
        await request("/sign-in/email", {
          email: email("disabled-during-link"),
          password: "GoogleTestPassword123!",
        })
      ).statusCode,
    ).toBe(403);
  });
});
