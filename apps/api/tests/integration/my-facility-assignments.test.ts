import { afterAll, beforeAll, beforeEach, expect, mock, spyOn, test } from "bun:test";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { FacilityAssignmentsRepository } from "../../src/modules/facilities/facility-assignments.repository";

let actor: { id: string; role: string; status: string } | null = null;
mock.module("../../src/modules/auth/auth", () => ({
  auth: {
    api: {
      getSession: async () => (actor ? { user: actor, session: { id: "fixture-session" } } : null),
    },
  },
}));
const { facilitiesRoutes } = await import("../../src/modules/facilities/facilities.routes");
const list = spyOn(FacilityAssignmentsRepository.prototype, "listUserAssignmentsWithFacilities");
const app = Fastify();
const userId = "10000000-0000-4000-8000-000000000001";
const facilityId = "20000000-0000-4000-8000-000000000001";
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
  actor = { id: userId, role: "FACILITY_MANAGER", status: "ACTIVE" };
  list
    .mockClear()
    .mockResolvedValue([{ assignment, facilityName: "Local facility", facilityCode: "HCM-01" }]);
});
afterAll(async () => {
  await app.close();
  list.mockRestore();
});
test("requires authentication before querying assignments", async () => {
  actor = null;
  const response = await app.inject({ method: "GET", url: "/api/facilities/my-assignments" });
  expect(response.statusCode).toBe(401);
  expect(list).not.toHaveBeenCalled();
});
for (const role of ["FACILITY_MANAGER", "FACILITY_STAFF"]) {
  test(`returns only the current ${role} account scope`, async () => {
    actor = { id: userId, role, status: "ACTIVE" };
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
  actor = { id: userId, role: "CUSTOMER", status: "ACTIVE" };
  const response = await app.inject({ method: "GET", url: "/api/facilities/my-assignments" });
  expect(response.statusCode).toBe(200);
  expect(response.json().data).toEqual([]);
  expect(list).not.toHaveBeenCalled();
});
