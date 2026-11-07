import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  db,
  eq,
  facilities,
  facilityAssignments,
  facilityUnitTypes,
  inArray,
  pricingChanges,
  systemSettingChanges,
  systemSettings,
  unitTypes,
  users,
} from "@metastorage/database";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { auth } from "../../src/modules/auth/auth";
import { facilitiesRoutes } from "../../src/modules/facilities/facilities.routes";
import { unitTypesRoutes } from "../../src/modules/unit-types/unit-types.routes";
import { assertTestDatabase } from "../fixtures/test-database";

const url = process.env.PRICING_TEST_DATABASE_URL;
describe.skipIf(!url)("BOM catalog and FM facility prices", () => {
  const bom = randomUUID(),
    manager = randomUUID(),
    facility = randomUUID(),
    other = randomUUID();
  const app = Fastify();
  let session: ReturnType<typeof spyOn<typeof auth.api, "getSession">>;
  let catalogId: string, offeringId: string;
  beforeAll(async () => {
    assertTestDatabase(url);
    await db.insert(users).values([
      {
        id: bom,
        name: "Catalog BOM",
        email: `${bom}@example.test`,
        role: "BUSINESS_OPERATION_MANAGER",
        status: "ACTIVE",
      },
      {
        id: manager,
        name: "Catalog FM",
        email: `${manager}@example.test`,
        role: "FACILITY_MANAGER",
        status: "ACTIVE",
      },
    ]);
    await db
      .insert(facilities)
      .values([facility, other].map((id) => ({ id, code: id, name: id, address: "test" })));
    await db
      .insert(facilityAssignments)
      .values({ userId: manager, facilityId: facility, role: "FACILITY_MANAGER" });
    await db
      .insert(systemSettings)
      .values({ key: "DEPOSIT_MONTHS", value: 1, version: 1, description: "Test deposit policy" })
      .onConflictDoNothing();
    session = spyOn(auth.api, "getSession").mockImplementation(async ({ headers }) => {
      const fm = new Headers(headers).has("x-fm");
      return {
        user: {
          id: fm ? manager : bom,
          role: fm ? "FACILITY_MANAGER" : "BUSINESS_OPERATION_MANAGER",
          status: "ACTIVE",
        },
        session: {},
      } as never;
    });
    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    await app.register(unitTypesRoutes, { prefix: "/api/unit-types" });
    await app.register(facilitiesRoutes, { prefix: "/api/facilities" });
    await app.ready();
  });
  afterAll(async () => {
    session?.mockRestore();
    await app.close();
    if (!url) return;
    await db.transaction(async (tx) => {
      await tx.delete(pricingChanges).where(inArray(pricingChanges.changedBy, [bom, manager]));
      await tx
        .delete(systemSettingChanges)
        .where(inArray(systemSettingChanges.actorId, [bom, manager]));
      await tx
        .update(systemSettings)
        .set({ updatedBy: null })
        .where(inArray(systemSettings.updatedBy, [bom, manager]));
      if (catalogId) {
        await tx.delete(facilityUnitTypes).where(eq(facilityUnitTypes.unitTypeId, catalogId));
        await tx.delete(unitTypes).where(eq(unitTypes.id, catalogId));
      }
      await tx.delete(facilityAssignments).where(eq(facilityAssignments.userId, manager));
      await tx.delete(facilities).where(inArray(facilities.id, [facility, other]));
      await tx.delete(users).where(inArray(users.id, [bom, manager]));
    });
  });
  test("BOM owns standard metadata and required price bounds", async () => {
    const payload = {
      code: bom,
      name: "Standard",
      sizeLabel: "1m",
      coverUrl: "https://example.com/type.jpg",
      lengthM: 1,
      widthM: 1,
      heightM: 1,
      minMonthlyPrice: 100,
      maxMonthlyPrice: 1000,
    };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/unit-types/",
          headers: { "x-fm": "1" },
          payload,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/unit-types/",
          payload: { ...payload, minMonthlyPrice: 2000 },
        })
      ).statusCode,
    ).toBe(400);
    const response = await app.inject({ method: "POST", url: "/api/unit-types/", payload });
    expect(response.statusCode).toBe(201);
    catalogId = response.json().data.id;
  });
  test("FM can configure only assigned facilities and valid prices", async () => {
    const payload = { unitTypeId: catalogId, monthlyPrice: 500 };
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/facilities/${other}/unit-types`,
          headers: { "x-fm": "1" },
          payload,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ method: "POST", url: `/api/facilities/${facility}/unit-types`, payload }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/facilities/${facility}/unit-types`,
          headers: { "x-fm": "1" },
          payload: { ...payload, monthlyPrice: 1001 },
        })
      ).statusCode,
    ).toBe(409);
    const response = await app.inject({
      method: "POST",
      url: `/api/facilities/${facility}/unit-types`,
      headers: { "x-fm": "1" },
      payload,
    });
    expect(response.statusCode).toBe(201);
    offeringId = response.json().data.id;
    expect(offeringId).not.toBe(catalogId);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/facilities/${facility}/unit-types`,
          headers: { "x-fm": "1" },
          payload,
        })
      ).statusCode,
    ).toBe(409);
    const publicList = await app.inject({
      method: "GET",
      url: `/api/facilities/${facility}/unit-types`,
    });
    expect(publicList.json().data).toEqual([
      expect.objectContaining({ id: offeringId, name: "Standard", monthlyPrice: 500, lengthM: 1 }),
    ]);
  });
  test("bounds changes and FM prices remain consistent under concurrent writes", async () => {
    const responses = await Promise.all([
      app.inject({
        method: "PATCH",
        url: `/api/unit-types/${catalogId}`,
        payload: { expectedVersion: 0, maxMonthlyPrice: 600 },
      }),
      app.inject({
        method: "PATCH",
        url: `/api/facilities/${facility}/unit-types/${offeringId}`,
        headers: { "x-fm": "1" },
        payload: { expectedVersion: 0, monthlyPrice: 900 },
      }),
    ]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    const [catalog] = await db.select().from(unitTypes).where(eq(unitTypes.id, catalogId));
    const [offering] = await db
      .select()
      .from(facilityUnitTypes)
      .where(eq(facilityUnitTypes.id, offeringId));
    if (!offering || !catalog) throw new Error("Missing catalog offering after concurrent updates");
    expect(offering.monthlyPrice).toBeGreaterThanOrEqual(catalog.minMonthlyPrice);
    expect(offering.monthlyPrice).toBeLessThanOrEqual(catalog.maxMonthlyPrice);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/facilities/${facility}/unit-types/${offeringId}`,
          headers: { "x-fm": "1" },
          payload: { expectedVersion: offering.version, lengthM: 5 },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/unit-types/${catalogId}`,
          headers: { "x-fm": "1" },
          payload: { expectedVersion: catalog.version, minMonthlyPrice: 1 },
        })
      ).statusCode,
    ).toBe(403);
  });
});
