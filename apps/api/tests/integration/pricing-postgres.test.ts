import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  reservations as bookings,
  checkInSlots,
  db,
  eq,
  facilities,
  facilityAssignments,
  inArray,
  pricingChanges,
  storageUnits,
  systemSettingChanges,
  systemSettings,
  unitTypes,
  users,
} from "@metastorage/database";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { seedPricingPolicy } from "../../../../packages/database/src/seed";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { auth } from "../../src/modules/auth/auth";
import { pricingRoutes } from "../../src/modules/pricing/pricing.routes";
import { reservationsRoutes as bookingsRoutes } from "../../src/modules/reservations/reservations.routes";
import { createTestUnitType, deleteTestUnitTypes } from "../fixtures/facility-catalog";

const testUrl = process.env.PRICING_TEST_DATABASE_URL;
describe.skipIf(!testUrl)("pricing transactions with isolated PostgreSQL", () => {
  const ids = {
    actor: randomUUID(),
    manager: randomUUID(),
    type: randomUUID(),
    facility: randomUUID(),
    unit: randomUUID(),
    slot: randomUUID(),
  };
  const app = Fastify();
  let session: ReturnType<typeof spyOn<typeof auth.api, "getSession">>;
  let created = false;
  const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const draft = () =>
    app.inject({
      method: "POST",
      url: "/api/reservations/drafts",
      headers: { "x-customer": "1" },
      payload: {
        facilityId: ids.facility,
        unitTypeId: ids.type,
        checkInDate: date,
        checkInSlotId: ids.slot,
        durationMonths: 2,
      },
    });
  const patch = (payload: object, suffix = "") =>
    app.inject({
      method: "PATCH",
      url: `/api/business-rules/pricing${suffix}`,
      headers: suffix ? { "x-manager": "1" } : {},
      payload,
    });

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== testUrl)
      throw new Error(
        "DATABASE_URL must match PRICING_TEST_DATABASE_URL (empty isolated test database)",
      );
    if (
      (await db.select().from(systemSettings).where(eq(systemSettings.key, "DEPOSIT_MONTHS")))
        .length ||
      (await db.select().from(pricingChanges)).length
    )
      throw new Error("Use an empty isolated pricing test database");
    await db.insert(users).values({
      id: ids.actor,
      name: "Pricing test BOM",
      email: `${ids.actor}@example.test`,
      role: "BUSINESS_OPERATION_MANAGER",
      status: "ACTIVE",
    });
    await db.insert(users).values({
      id: ids.manager,
      name: "Pricing FM",
      email: `${ids.manager}@example.test`,
      role: "FACILITY_MANAGER",
      status: "ACTIVE",
    });
    await db
      .insert(facilities)
      .values({ id: ids.facility, code: ids.facility, name: "Pricing test", address: "Test" });
    await db
      .insert(facilityAssignments)
      .values({ userId: ids.manager, facilityId: ids.facility, role: "FACILITY_MANAGER" });
    await createTestUnitType(db, {
      facilityId: ids.facility,
      id: ids.type,
      code: ids.type,
      name: "Pricing type",
      sizeLabel: "S",
      lengthM: 1,
      widthM: 1,
      heightM: 1,
      monthlyPrice: 750000,
    });

    await db
      .insert(storageUnits)
      .values({ id: ids.unit, code: ids.unit, facilityId: ids.facility, unitTypeId: ids.type });
    await db
      .insert(checkInSlots)
      .values({ id: ids.slot, name: "Pricing slot", startTime: "09:00", endTime: "10:00" });
    created = true;
    session = spyOn(auth.api, "getSession").mockImplementation(async ({ headers }) =>
      new Headers(headers).has("x-customer")
        ? ({ user: { id: ids.actor, role: "CUSTOMER", status: "ACTIVE" }, session: {} } as never)
        : new Headers(headers).has("x-manager")
          ? ({
              user: { id: ids.manager, role: "FACILITY_MANAGER", status: "ACTIVE" },
              session: {},
            } as never)
          : ({
              user: { id: ids.actor, role: "BUSINESS_OPERATION_MANAGER", status: "ACTIVE" },
              session: {},
            } as never),
    );
    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    await app.register(pricingRoutes, { prefix: "/api/business-rules" });
    await app.register(bookingsRoutes, { prefix: "/api/reservations" });
    await app.ready();
  });
  beforeEach(async () => {
    await db.delete(bookings).where(eq(bookings.facilityId, ids.facility));
    await db
      .delete(pricingChanges)
      .where(inArray(pricingChanges.changedBy, [ids.actor, ids.manager]));
    await db
      .delete(systemSettingChanges)
      .where(inArray(systemSettingChanges.actorId, [ids.actor, ids.manager]));
    await db.delete(systemSettings).where(eq(systemSettings.key, "DEPOSIT_MONTHS"));
    await seedPricingPolicy();
    await db
      .update(unitTypes)
      .set({ monthlyPrice: 750000, version: 0, updatedBy: null })
      .where(eq(unitTypes.id, ids.type));
  });
  afterAll(async () => {
    await app.close();
    session?.mockRestore();
    if (!created) return;
    await db.delete(bookings).where(eq(bookings.facilityId, ids.facility));
    await db
      .delete(pricingChanges)
      .where(inArray(pricingChanges.changedBy, [ids.actor, ids.manager]));
    await db
      .delete(systemSettingChanges)
      .where(inArray(systemSettingChanges.actorId, [ids.actor, ids.manager]));
    await db.delete(systemSettings).where(eq(systemSettings.key, "DEPOSIT_MONTHS"));
    await db.delete(storageUnits).where(eq(storageUnits.id, ids.unit));

    await deleteTestUnitTypes(db, eq(unitTypes.id, ids.type));
    await db.delete(facilities).where(eq(facilities.id, ids.facility));
    await db.delete(checkInSlots).where(eq(checkInSlots.id, ids.slot));
    await db.delete(facilityAssignments).where(eq(facilityAssignments.userId, ids.manager));
    await db.delete(users).where(inArray(users.id, [ids.actor, ids.manager]));
  });

  test("updates price/policy with audit and keeps pre-existing draft snapshots", async () => {
    const first = await draft();
    expect(first.statusCode).toBe(201);
    expect(first.json().data.totalAmount).toBe(2250000);
    expect(
      (await patch({ expectedVersion: 0, monthlyPrice: 900000 }, `/${ids.type}`)).statusCode,
    ).toBe(200);
    expect((await patch({ expectedVersion: 2, depositMonths: 2 })).statusCode).toBe(200);
    const next = await draft();
    expect(next.statusCode).toBe(201);
    expect(next.json().data).toMatchObject({
      monthlyRateSnapshot: 900000,
      depositAmount: 1800000,
      rentalFeeAmount: 1800000,
      totalAmount: 3600000,
    });
    const [old] = await db.select().from(bookings).where(eq(bookings.id, first.json().data.id));
    expect(Number(old?.totalAmount)).toBe(2250000);
    expect(Number(old?.depositAmount)).toBe(750000);
    const history = await app.inject({ method: "GET", url: "/api/business-rules/pricing/history" });
    expect(history.json().data).toHaveLength(2);
    expect(history.json().data[0]).toMatchObject({
      version: 3,
      changedBy: ids.actor,
      before: { depositMonths: 1 },
      after: { depositMonths: 2 },
    });
  });
  test("concurrent writes with the same version produce one winner and one conflict", async () => {
    const results = await Promise.all([
      patch({ expectedVersion: 1, depositMonths: 2 }),
      patch({ expectedVersion: 1, depositMonths: 3 }),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(await db.select().from(pricingChanges)).toHaveLength(1);
    const result = await app.inject({ method: "GET", url: "/api/business-rules/pricing" });
    expect(result.json().data.version).toBe(2);
  });
  test("failed price mutation rolls back policy version and audit", async () => {
    expect(
      (await patch({ expectedVersion: 1, monthlyPrice: 1 }, `/${randomUUID()}`)).statusCode,
    ).toBe(404);
    const [settings] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "DEPOSIT_MONTHS"));
    expect(settings?.version).toBe(1);
    expect(await db.select().from(pricingChanges)).toHaveLength(0);
  });
  test("missing policy blocks draft and repeated seed never overwrites a changed policy", async () => {
    await db.delete(systemSettings).where(eq(systemSettings.key, "DEPOSIT_MONTHS"));
    expect((await draft()).statusCode).toBe(503);
    const unavailable = await app.inject({ method: "GET", url: "/api/business-rules/pricing" });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json().error.code).toBe(503);
    await seedPricingPolicy();
    expect((await patch({ expectedVersion: 1, depositMonths: 2 })).statusCode).toBe(200);
    await seedPricingPolicy();
    const [settings] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "DEPOSIT_MONTHS"));
    expect(settings?.value).toBe(2);
    expect(settings?.version).toBe(2);
  });
});
