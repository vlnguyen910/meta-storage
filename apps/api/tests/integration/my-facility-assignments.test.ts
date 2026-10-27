import { afterAll, beforeAll, beforeEach, expect, spyOn, test } from "bun:test";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { type AuthUser, auth } from "../../src/modules/auth/auth";
import { FacilityAssignmentsRepository } from "../../src/modules/facilities/facility-assignments.repository";

// Keep the real auth module/handler shared by other suites; restore only this spy.
let actor: AuthUser | null = null;
const getSession = spyOn(auth.api, "getSession");
const { facilitiesRoutes } = await import("../../src/modules/facilities/facilities.routes");
const list = spyOn(FacilityAssignmentsRepository.prototype, "listUserAssignmentsWithFacilities");
const app = Fastify();
const userId = "10000000-0000-4000-8000-000000000001";
const facilityId = "20000000-0000-4000-8000-000000000001";
const actorFixture: AuthUser = {
  id: userId,
  name: "Facility account",
  email: "facility-account@example.test",
  emailVerified: true,
  image: null,
  role: "FACILITY_MANAGER",
  status: "ACTIVE",
  createdAt: new Date("2026-10-19T00:00:00Z"),
  updatedAt: new Date("2026-10-19T00:00:00Z"),
};
const assignment = {
  id: "30000000-0000-4000-8000-000000000001",
  userId,
  facilityId,
  role: "FACILITY_MANAGER",
  isActive: true,
  assignedAt: new Date("2026-10-19T00:00:00Z"),
  endedAt: null,
};
beforeAll(async () => {
  app.decorate("db", {});
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  setupErrorHandler(app);
  await app.register(facilitiesRoutes, { prefix: "/api/facilities" });
  await app.ready();
});
beforeEach(() => {
  actor = { ...actorFixture };
  getSession.mockImplementation(async () =>
    actor
      ? {
          user: actor,
          session: {
            id: "fixture-session",
            token: "fixture-token",
            userId,
            expiresAt: new Date("2099-01-01T00:00:00Z"),
            createdAt: actorFixture.createdAt,
            updatedAt: actorFixture.updatedAt,
            ipAddress: null,
            userAgent: null,
          },
        }
      : null,
  );
  list
    .mockClear()
    .mockResolvedValue([{ assignment, facilityName: "Local facility", facilityCode: "HCM-01" }]);
});
afterAll(async () => {
  await app.close();
  list.mockRestore();
  getSession.mockRestore();
});
test("requires authentication before querying assignments", async () => {
  actor = null;
  const response = await app.inject({ method: "GET", url: "/api/facilities/my-assignments" });
  expect(response.statusCode).toBe(401);
  expect(list).not.toHaveBeenCalled();
});
for (const role of ["FACILITY_MANAGER", "FACILITY_STAFF"] as const) {
  test(`returns only the current ${role} account scope`, async () => {
    actor = { ...actorFixture, role };
    list.mockResolvedValue([
      {
        assignment: { ...assignment, role },
        facilityName: "Local facility",
        facilityCode: "HCM-01",
      },
    ]);
    const response = await app.inject({
      method: "GET",
      url: "/api/facilities/my-assignments?userId=other-user",
    });
    expect(response.statusCode).toBe(200);
    expect(list).toHaveBeenCalledWith(userId, role);
    expect(response.json().data).toEqual([
      {
        ...assignment,
        role,
        assignedAt: assignment.assignedAt.toISOString(),
        facilityName: "Local facility",
        facilityCode: "HCM-01",
      },
    ]);
  });
}
test("accounts without facility roles receive an empty list", async () => {
  actor = { ...actorFixture, role: "CUSTOMER" };
  const response = await app.inject({ method: "GET", url: "/api/facilities/my-assignments" });
  expect(response.statusCode).toBe(200);
  expect(response.json().data).toEqual([]);
  expect(list).not.toHaveBeenCalled();
});
