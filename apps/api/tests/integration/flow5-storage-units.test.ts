import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { queryClient } from "@metastorage/database";
import { storageUnitsRoutes } from "../../src/modules/storage-units/storage-units.routes";
import { createFacilityOperationsFixture } from "../fixtures/facility-operations";

describe.skipIf(!process.env.MY_STORAGE_LOCAL_DATABASE_URL)("Flow 5 storage unit inventory", () => {
  let f: Awaited<ReturnType<typeof createFacilityOperationsFixture>>;
  beforeAll(async () => {
    f = await createFacilityOperationsFixture();
    await f.app.register(storageUnitsRoutes, { prefix: "/api/storage-units" });
    await f.app.register(storageUnitsRoutes, { prefix: "/api/units" });
    await f.login();
  });
  afterAll(async () => {
    try {
      if (f) await f.cleanup();
    } finally {
      await queryClient.end();
    }
  });
  test("authentication and facility scope protect both inventory paths", async () => {
    for (const prefix of ["/storage-units", "/units"]) {
      const path = `${prefix}?facilityId=${f.facilityId}`;
      expect((await f.api(null, "GET", path)).statusCode).toBe(401);
      for (const who of ["customer", "otherManager", "otherStaff", "expiredStaff"] as const) {
        expect((await f.api(who, "GET", path)).statusCode).toBe(403);
      }
      for (const who of ["manager", "staff", "admin", "bom"] as const) {
        const r = await f.api(who, "GET", path);
        expect(r.statusCode).toBe(200);
        expect(r.json().data.total).toBe(2);
        expect(
          r.json().data.items.every((u: { facilityId: string }) => u.facilityId === f.facilityId),
        ).toBe(true);
      }
    }
  });
  test("filters and pagination return stable results with the full filtered total", async () => {
    const path = `/storage-units?facilityId=${f.facilityId}`;
    const first = await f.api("manager", "GET", `${path}&limit=1`);
    expect(first.statusCode).toBe(200);
    expect(first.json().data).toMatchObject({ total: 2, limit: 1, offset: 0 });
    expect(first.json().data.items[0]).toMatchObject({
      id: f.unitId,
      unitTypeName: "Flow 5 type",
      floor: "1",
      locationDescription: "Door A",
    });
    const second = await f.api("manager", "GET", `${path}&limit=1&offset=1`);
    expect(second.json().data.items[0].id).toBe(f.maintenanceUnitId);
    const filtered = await f.api(
      "manager",
      "GET",
      `${path}&status=MAINTENANCE&unitTypeId=${f.otherTypeId}`,
    );
    expect(filtered.json().data.total).toBe(1);
    expect(filtered.json().data.items[0].id).toBe(f.maintenanceUnitId);
    const empty = await f.api("manager", "GET", `${path}&offset=100`);
    expect(empty.json().data).toMatchObject({ total: 2, items: [] });
    expect((await f.api("manager", "GET", `${path}&status=OCCUPIED`)).json().data.total).toBe(0);
  });
  test("rejects invalid filters and distinguishes missing facilities", async () => {
    for (const query of [
      "",
      "?facilityId=bad",
      `?facilityId=${f.facilityId}&status=PAID`,
      `?facilityId=${f.facilityId}&limit=101`,
      `?facilityId=${f.facilityId}&offset=-1`,
    ]) {
      expect((await f.api("manager", "GET", `/storage-units${query}`)).statusCode).toBe(400);
    }
    expect(
      (await f.api("admin", "GET", `/storage-units?facilityId=${randomUUID()}`)).statusCode,
    ).toBe(404);
  });
  test("detail endpoints enforce role and active facility assignments", async () => {
    for (const prefix of ["/storage-units", "/units"]) {
      const path = `${prefix}/${f.unitId}`;
      expect((await f.api(null, "GET", path)).statusCode).toBe(401);
      for (const who of ["customer", "otherManager", "otherStaff", "expiredStaff"] as const)
        expect((await f.api(who, "GET", path)).statusCode).toBe(403);
      for (const who of ["manager", "staff", "admin", "bom"] as const) {
        const r = await f.api(who, "GET", path);
        expect(r.statusCode).toBe(200);
        expect(r.json().data).toMatchObject({
          id: f.unitId,
          facilityId: f.facilityId,
          status: "AVAILABLE",
        });
        expect(typeof r.json().data.createdAt).toBe("string");
      }
    }
    expect((await f.api("manager", "GET", `/storage-units/${f.otherUnitId}`)).statusCode).toBe(403);
    expect((await f.api("manager", "GET", `/storage-units/${randomUUID()}`)).statusCode).toBe(404);
  });
});
