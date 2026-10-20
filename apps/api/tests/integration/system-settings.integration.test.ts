import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  db,
  eq,
  inArray,
  pricingChanges,
  queryClient,
  returnAudit,
  sql,
  systemSettingChanges,
  systemSettings,
  unitTypes,
  users,
} from "@metastorage/database";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { applyMigrations } from "../../../../packages/database/src/migrate";
import { seedPricingPolicy } from "../../../../packages/database/src/seed";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { auth } from "../../src/modules/auth/auth";
import { PricingRepository } from "../../src/modules/pricing/pricing.repository";
import { pricingRoutes } from "../../src/modules/pricing/pricing.routes";
import { RentalLifecycleSettingsRepository } from "../../src/modules/rental-lifecycle-settings/rental-lifecycle-settings.repository";
import { rentalLifecycleSettingsRoutes } from "../../src/modules/rental-lifecycle-settings/rental-lifecycle-settings.routes";
import { returnsRoutes } from "../../src/modules/returns/returns.routes";
import { systemSettingsRoutes } from "../../src/modules/system-settings/system-settings.routes";

const localUrl = process.env.MY_STORAGE_LOCAL_DATABASE_URL;
describe.skipIf(!localUrl)("unified settings using existing local PostgreSQL", () => {
  const ids = { admin: randomUUID(), bom: randomUUID(), staff: randomUUID(), type: randomUUID() };
  const roles = {
    admin: "SYSTEM_ADMIN",
    bom: "BUSINESS_OPERATION_MANAGER",
    staff: "FACILITY_STAFF",
  } as const;
  const app = Fastify();
  let session: ReturnType<typeof spyOn<typeof auth.api, "getSession">>;
  let originals: (typeof systemSettings.$inferSelect)[] = [];
  let created = false;
  const request = (
    role: keyof typeof roles | null,
    method: "GET" | "PUT" | "PATCH",
    path: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url: `/api${path}`,
      headers: role ? { "x-test-role": role } : {},
      payload,
    });
  const row = async (key: (typeof systemSettings.$inferSelect)["key"]) => {
    const [value] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    if (!value) throw new Error(`Missing local fixture setting ${key}`);
    return value;
  };

  beforeAll(async () => {
    const url = new URL(localUrl ?? "http://invalid");
    if (
      process.env.DATABASE_URL !== localUrl ||
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      url.port !== "5433" ||
      url.pathname !== "/metastorage"
    )
      throw new Error("Use the existing local container database; no separate database/reset");
    originals = await db.select().from(systemSettings);
    expect(originals).toHaveLength(4);
    await db.insert(users).values(
      Object.entries(roles).map(([key, role]) => ({
        id: ids[key as keyof typeof roles],
        name: "Settings integration",
        email: `${ids[key as keyof typeof roles]}@example.test`,
        role,
        status: "ACTIVE" as const,
      })),
    );
    await db.insert(unitTypes).values({
      id: ids.type,
      code: ids.type,
      name: "Settings test type",
      sizeLabel: "S",
      lengthM: 1,
      widthM: 1,
      heightM: 1,
      monthlyPrice: 123000,
    });
    created = true;
    session = spyOn(auth.api, "getSession").mockImplementation(async ({ headers }) => {
      const role = new Headers(headers).get("x-test-role") as keyof typeof roles | null;
      return role && roles[role]
        ? ({ user: { id: ids[role], role: roles[role], status: "ACTIVE" }, session: {} } as never)
        : null;
    });
    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    await app.register(systemSettingsRoutes, { prefix: "/api" });
    await app.register(rentalLifecycleSettingsRoutes, { prefix: "/api" });
    await app.register(pricingRoutes, { prefix: "/api/business-rules" });
    await app.register(returnsRoutes, { prefix: "/api" });
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    session?.mockRestore();
    try {
      if (created)
        await db.transaction(async (tx) => {
          const actors = [ids.admin, ids.bom, ids.staff];
          await tx
            .delete(systemSettingChanges)
            .where(inArray(systemSettingChanges.actorId, actors));
          await tx.delete(pricingChanges).where(inArray(pricingChanges.changedBy, actors));
          await tx.delete(returnAudit).where(inArray(returnAudit.actorId, actors));
          for (const original of originals)
            await tx
              .update(systemSettings)
              .set(original)
              .where(eq(systemSettings.key, original.key));
          await tx.delete(unitTypes).where(eq(unitTypes.id, ids.type));
          await tx.delete(users).where(inArray(users.id, actors));
        });
    } finally {
      await queryClient.end();
    }
  });

  test("authorization is per key; Admin cannot read or change BOM financial policy", async () => {
    expect((await request(null, "GET", "/system-settings")).statusCode).toBe(401);
    expect((await request("staff", "GET", "/system-settings")).statusCode).toBe(403);
    const admin = await request("admin", "GET", "/system-settings");
    expect(admin.headers["cache-control"]).toBe("private, no-store");
    expect(
      admin
        .json()
        .data.map((r: { key: string }) => r.key)
        .sort(),
    ).toEqual(["ABANDONED_REVIEW_DAYS", "EXPIRY_REMINDER_DAYS"]);
    expect(
      (await request("bom", "GET", "/system-settings"))
        .json()
        .data.map((r: { key: string }) => r.key)
        .sort(),
    ).toEqual(["DEPOSIT_MONTHS", "OVERDUE_FEE_RATE"]);
    const value = await row("OVERDUE_FEE_RATE");
    expect(
      (
        await request("admin", "PUT", "/system-settings", {
          key: value.key,
          value: 10,
          expectedVersion: value.version,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await request("admin", "GET", "/system-settings/OVERDUE_FEE_RATE/history")).statusCode,
    ).toBe(403);
  });

  test("validation rejects arbitrary keys, wrong types and invalid approved policy bounds", async () => {
    for (const payload of [
      { key: "UNREGISTERED", value: 1, expectedVersion: 0 },
      { key: "EXPIRY_REMINDER_DAYS", value: "7", expectedVersion: 0 },
      { key: "EXPIRY_REMINDER_DAYS", value: -1, expectedVersion: 0 },
      { key: "EXPIRY_REMINDER_DAYS", value: 1.5, expectedVersion: 0 },
      { key: "EXPIRY_REMINDER_DAYS", value: 2147483648, expectedVersion: 0 },
      { key: "OVERDUE_FEE_RATE", value: 101, expectedVersion: 0 },
      { key: "DEPOSIT_MONTHS", value: 0, expectedVersion: 1 },
    ])
      expect((await request("admin", "PUT", "/system-settings", payload)).statusCode).toBe(400);
  });

  test("concurrent common/legacy updates share one lock/version and one audit", async () => {
    const before = await row("EXPIRY_REMINDER_DAYS");
    const results = await Promise.all([
      request("admin", "PUT", "/system-settings", {
        key: before.key,
        value: 0,
        expectedVersion: before.version,
      }),
      request("admin", "PUT", "/return-policy/lifecycle-settings", {
        key: before.key,
        value: 9,
        expectedVersion: before.version,
      }),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const current = await row(before.key);
    expect(current.version).toBe(before.version + 1);
    const history = await request(
      "admin",
      "GET",
      `/system-settings/${before.key}/history?limit=1&offset=0`,
    );
    expect(history.statusCode).toBe(200);
    expect(history.json().data[0]).toMatchObject({
      before: { value: before.value, version: before.version },
      after: { value: current.value, version: current.version },
      actorId: ids.admin,
    });
    expect(
      (await request("admin", "GET", "/return-policy/lifecycle-settings"))
        .json()
        .data.find((r: { key: string }) => r.key === before.key).value,
    ).toBe(current.value);
  });

  test("audit failure rolls back both setting and inserted audit history", async () => {
    const before = await row("ABANDONED_REVIEW_DAYS");
    const originalAudit = RentalLifecycleSettingsRepository.prototype.audit;
    const audit = spyOn(RentalLifecycleSettingsRepository.prototype, "audit").mockImplementation(
      async function (...args) {
        await originalAudit.apply(this, args);
        throw new Error("Injected audit failure");
      },
    );
    try {
      expect(
        (
          await request("admin", "PUT", "/system-settings", {
            key: before.key,
            value: 3,
            expectedVersion: before.version,
          })
        ).statusCode,
      ).toBe(500);
      expect(await row(before.key)).toEqual(before);
      expect(
        (await request("admin", "GET", `/system-settings/${before.key}/history`)).json().data,
      ).toHaveLength(0);
    } finally {
      audit.mockRestore();
    }
  });

  test("financial settings reuse pricing revision and overdue APIs without granting Admin approval", async () => {
    const before = await row("DEPOSIT_MONTHS");
    const results = await Promise.all([
      request("bom", "PUT", "/system-settings", {
        key: before.key,
        value: 2,
        expectedVersion: before.version,
      }),
      request("bom", "PATCH", `/business-rules/pricing/${ids.type}`, {
        monthlyPrice: 124000,
        expectedVersion: before.version,
      }),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const current = await row(before.key);
    const pricing = await request("bom", "GET", "/business-rules/pricing");
    expect(pricing.json().data).toMatchObject({
      depositMonths: current.value,
      version: current.version,
    });
    const quote = await new PricingRepository(db).findQuote(ids.type);
    expect(quote?.depositMonths).toBe(current.value);
    const rate = await row("OVERDUE_FEE_RATE");
    expect(
      (
        await request("bom", "PUT", "/system-settings", {
          key: rate.key,
          value: 0,
          expectedVersion: rate.version,
        })
      ).statusCode,
    ).toBe(200);
    expect((await request("bom", "GET", "/return-policy/overdue-rate")).json().data).toEqual({
      rate: 0,
      version: rate.version + 1,
    });
    expect(
      (
        await request("bom", "PUT", "/return-policy/overdue-rate", {
          rate: 100,
          expectedVersion: rate.version + 1,
        })
      ).statusCode,
    ).toBe(200);
    expect((await row(rate.key)).value).toBe(100);
    expect(
      (await request("bom", "GET", `/system-settings/${rate.key}/history`)).json().data,
    ).toHaveLength(2);
  });

  test("failed financial audit actor rolls back policy, shared revision and domain history", async () => {
    const before = await row("DEPOSIT_MONTHS");
    const history = await db.select().from(pricingChanges);
    await expect(
      new PricingRepository(db).updateDeposit(
        { depositMonths: 3, expectedVersion: before.version },
        randomUUID(),
      ),
    ).rejects.toThrow();
    expect(await row(before.key)).toEqual(before);
    expect(await db.select().from(pricingChanges)).toEqual(history);
  });

  test("repeated policy seed preserves configured value, revision and actor metadata", async () => {
    const before = await row("DEPOSIT_MONTHS");
    await seedPricingPolicy();
    await seedPricingPolicy();
    expect(await row(before.key)).toEqual(before);
  });

  test("database constraints preserve integer, percentage and positive deposit invariants", async () => {
    for (const [key, value] of [
      ["OVERDUE_FEE_RATE", 101],
      ["OVERDUE_FEE_RATE", 0.5],
      ["DEPOSIT_MONTHS", 0],
      ["EXPIRY_REMINDER_DAYS", "7"],
    ] as const) {
      const before = await row(key);
      await expect(
        Promise.resolve(
          db.update(systemSettings).set({ value }).where(eq(systemSettings.key, key)),
        ),
      ).rejects.toThrow();
      expect(await row(key)).toEqual(before);
    }
  });

  test("migration failure rolls back generated DDL, journal and data writes", async () => {
    const before = await row("ABANDONED_REVIEW_DAYS");
    const table = `settings_rollback_${randomUUID().replaceAll("-", "")}`;
    const hash = randomUUID();
    await expect(
      applyMigrations(db, [
        {
          hash,
          bps: true,
          folderMillis: Date.now() + 1000000000000,
          sql: [
            `create table ${table} (id integer)`,
            `update system_settings set value = '123'::jsonb where key = 'ABANDONED_REVIEW_DAYS'`,
            "select nonexistent_settings_migration_function()",
          ],
        },
      ]),
    ).rejects.toThrow();
    expect(await row(before.key)).toEqual(before);
    const [exists] = await db.execute(sql`select to_regclass(${table}) as name`);
    expect(exists?.name).toBeNull();
    const journalRows = await db.execute(
      sql`select hash from drizzle.__drizzle_migrations where hash = ${hash}`,
    );
    expect(journalRows).toHaveLength(0);
  });
});
