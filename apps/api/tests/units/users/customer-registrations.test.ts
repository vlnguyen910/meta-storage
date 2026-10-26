import { afterAll, beforeAll, describe, expect, it, spyOn } from "bun:test";
import type { Database } from "@metastorage/database";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../../src/common/errors/error-handler";
import { auth } from "../../../src/modules/auth/auth";
import type { AuthService } from "../../../src/modules/auth/auth.service";
import { UsersRepository } from "../../../src/modules/users/users.repository";
import { usersRoutes } from "../../../src/modules/users/users.routes";
import { UsersService } from "../../../src/modules/users/users.service";

describe("monthly customer registrations", () => {
  it("fills missing months for the selected calendar year", async () => {
    const calls: { from: Date; to: Date }[] = [];
    const repository = {
      customerRegistrations: async (from: Date, to: Date) => {
        calls.push({ from, to });
        return [
          { month: "2026-01", count: 2 },
          { month: "2026-10", count: 3 },
        ];
      },
      customerRegistrationYears: async () => [2025, 2026],
      dashboardSummary: async () => ({
        totalUsers: 20,
        activeUsers: 17,
        inactiveUsers: 3,
        unassignedFacilityUsers: 2,
      }),
    } as unknown as UsersRepository;
    const service = new UsersService(repository, {} as AuthService);

    const result = await service.customerRegistrations(2026);

    expect(calls).toEqual([
      { from: new Date("2026-01-01T00:00:00Z"), to: new Date("2027-01-01T00:00:00Z") },
    ]);
    expect(result.year).toBe(2026);
    expect(result.years).toContain(2025);
    expect(result.items).toHaveLength(12);
    expect(result.items[0]).toEqual({ month: "2026-01", count: 2 });
    expect(result.items[1]).toEqual({ month: "2026-02", count: 0 });
    expect(result.items[9]).toEqual({ month: "2026-10", count: 3 });
    expect(result.summary).toEqual({
      totalUsers: 20,
      activeUsers: 17,
      inactiveUsers: 3,
      unassignedFacilityUsers: 2,
    });
  });
});

describe("customer registration statistics endpoint", () => {
  const app = Fastify();
  const sessions = spyOn(auth.api, "getSession");
  const registrations = spyOn(UsersRepository.prototype, "customerRegistrations");
  const years = spyOn(UsersRepository.prototype, "customerRegistrationYears");
  const summary = spyOn(UsersRepository.prototype, "dashboardSummary");

  beforeAll(async () => {
    sessions.mockImplementation(async ({ headers }) => {
      const role = new Headers(headers).get("x-test-role");
      return role ? ({ user: { id: "test", role, status: "ACTIVE" }, session: {} } as never) : null;
    });
    registrations.mockResolvedValue([{ month: "2025-10", count: 3 }]);
    years.mockResolvedValue([2025]);
    summary.mockResolvedValue({
      totalUsers: 20,
      activeUsers: 17,
      inactiveUsers: 3,
      unassignedFacilityUsers: 2,
    });
    app.decorate("db", {} as Database);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    await app.register(usersRoutes, { prefix: "/api/users" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    sessions.mockRestore();
    registrations.mockRestore();
    years.mockRestore();
    summary.mockRestore();
  });

  it("allows only admins and returns counts without customer details", async () => {
    const url = "/api/users/customer-registrations?year=2025";
    expect((await app.inject({ method: "GET", url })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: "GET", url, headers: { "x-test-role": "CUSTOMER" } })).statusCode,
    ).toBe(403);
    const response = await app.inject({
      method: "GET",
      url,
      headers: { "x-test-role": "SYSTEM_ADMIN" },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.items).toHaveLength(12);
    expect(body.data.items[9]).toEqual({ month: "2025-10", count: 3 });
    expect(body.data.years).toContain(2025);
    expect(body.data.summary.totalUsers).toBe(20);
    expect(JSON.stringify(body)).not.toContain("email");
    expect(
      (
        await app.inject({
          method: "GET",
          url: `${url}&year=bad`,
          headers: { "x-test-role": "SYSTEM_ADMIN" },
        })
      ).statusCode,
    ).toBe(400);
  });
});
