import { randomUUID } from "node:crypto";
import {
  accounts,
  db,
  facilities,
  facilityAssignments,
  inArray,
  storageUnits,
  unitTypes,
  users,
} from "@metastorage/database";
import Fastify, { type HTTPMethods } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { auth } from "../../src/modules/auth/auth";
import { authPlugin } from "../../src/modules/auth/auth.guard";
import { authRoutes } from "../../src/modules/auth/auth.routes";
import { createTestUnitType, deleteTestUnitTypes } from "./facility-catalog";
import { assertTestDatabase } from "./test-database";

export async function createFacilityOperationsFixture() {
  assertTestDatabase(process.env.MY_STORAGE_LOCAL_DATABASE_URL, process.env);
  const roles = {
    manager: "FACILITY_MANAGER",
    otherManager: "FACILITY_MANAGER",
    staff: "FACILITY_STAFF",
    peerStaff: "FACILITY_STAFF",
    otherStaff: "FACILITY_STAFF",
    expiredStaff: "FACILITY_STAFF",
    inactiveStaff: "FACILITY_STAFF",
    customer: "CUSTOMER",
    admin: "SYSTEM_ADMIN",
    bom: "BUSINESS_OPERATION_MANAGER",
  } as const;
  type Actor = keyof typeof roles;
  const ids = Object.fromEntries(Object.keys(roles).map((key) => [key, randomUUID()])) as Record<
    Actor,
    string
  >;
  const facilityId = randomUUID(),
    otherFacilityId = randomUUID();
  const typeId = randomUUID(),
    otherTypeId = randomUUID(),
    foreignTypeId = randomUUID();
  const unitId = randomUUID(),
    maintenanceUnitId = randomUUID(),
    otherUnitId = randomUUID();
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  setupErrorHandler(app);
  app.decorate("db", db);
  await app.register(authPlugin);
  await app.register(authRoutes, { prefix: "/api" });
  const password = "FacilityOperationsTest123!";
  const hashed = await (await auth.$context).password.hash(password);
  await db.transaction(async (tx) => {
    for (const [key, role] of Object.entries(roles)) {
      const id = ids[key as Actor];
      await tx.insert(users).values({
        id,
        name: key,
        email: `${id}@example.test`,
        role,
        status: key === "inactiveStaff" ? "INACTIVE" : "ACTIVE",
        emailVerified: true,
      });
      await tx.insert(accounts).values({
        id: randomUUID(),
        userId: id,
        accountId: id,
        providerId: "credential",
        password: hashed,
      });
    }
    await tx.insert(facilities).values([
      { id: facilityId, code: facilityId, name: "Flow 5 local", address: "Test" },
      { id: otherFacilityId, code: otherFacilityId, name: "Flow 5 other", address: "Test" },
    ]);
    for (const key of [
      "manager",
      "otherManager",
      "staff",
      "peerStaff",
      "otherStaff",
      "expiredStaff",
      "inactiveStaff",
    ] as const) {
      await tx.insert(facilityAssignments).values({
        userId: ids[key],
        role: roles[key],
        facilityId: key.startsWith("other") ? otherFacilityId : facilityId,
        endedAt: key === "expiredStaff" ? new Date("2000-01-01") : null,
      });
    }
    for (const id of [typeId, otherTypeId, foreignTypeId])
      await createTestUnitType(tx, {
        id,
        facilityId: id === foreignTypeId ? otherFacilityId : facilityId,
        code: id,
        name: "Flow 5 type",
        sizeLabel: "4 m²",
        lengthM: 2,
        widthM: 2,
        heightM: 3,
        monthlyPrice: 1000000,
      });
    await tx.insert(storageUnits).values([
      {
        id: unitId,
        facilityId,
        unitTypeId: typeId,
        code: `A-${unitId}`,
        floor: "1",
        locationDescription: "Door A",
      },
      {
        id: maintenanceUnitId,
        facilityId,
        unitTypeId: otherTypeId,
        code: `B-${maintenanceUnitId}`,
        status: "MAINTENANCE",
      },
      {
        id: otherUnitId,
        facilityId: otherFacilityId,
        unitTypeId: foreignTypeId,
        code: `C-${otherUnitId}`,
      },
    ]);
  });
  const cookies = {} as Record<Actor, string>;
  return {
    app,
    ids,
    facilityId,
    otherFacilityId,
    typeId,
    otherTypeId,
    foreignTypeId,
    unitId,
    maintenanceUnitId,
    otherUnitId,
    async login() {
      await app.ready();
      for (const key of Object.keys(roles) as Actor[]) {
        if (key === "inactiveStaff") continue;
        const r = await app.inject({
          method: "POST",
          url: "/api/auth/sign-in/email",
          headers: { origin: "http://localhost:3000" },
          payload: { email: `${ids[key]}@example.test`, password },
        });
        if (r.statusCode !== 200) throw new Error(`Fixture login failed: ${key}: ${r.body}`);
        cookies[key] = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      }
    },
    api(who: Actor | null, method: HTTPMethods, url: string, payload?: unknown) {
      return app.inject({
        method,
        url: `/api${url}`,
        headers: who ? { cookie: cookies[who] } : {},
        payload,
      });
    },
    async cleanup() {
      await app.close();
      await db.transaction(async (tx) => {
        await tx
          .delete(storageUnits)
          .where(inArray(storageUnits.facilityId, [facilityId, otherFacilityId]));
        await tx
          .delete(facilityAssignments)
          .where(inArray(facilityAssignments.userId, Object.values(ids)));
        await deleteTestUnitTypes(tx, inArray(unitTypes.id, [typeId, otherTypeId, foreignTypeId]));
        await tx.delete(facilities).where(inArray(facilities.id, [facilityId, otherFacilityId]));
        await tx.delete(users).where(inArray(users.id, Object.values(ids)));
      });
    },
  };
}
