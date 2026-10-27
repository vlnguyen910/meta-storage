import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Facility, UnitType } from "@metastorage/database";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { auth } from "../../src/modules/auth/auth";
import { FacilitiesRepository } from "../../src/modules/facilities/facilities.repository";
import { FacilityUnitTypesRepository } from "../../src/modules/unit-types/facility-unit-types.repository";
import { UNIT_TYPE_MESSAGES } from "../../src/modules/unit-types/unit-types.messages";

// These GET routes are public. Keep the auth provider out of this suite and fail
// if either route unexpectedly attempts to retrieve a session.
const getSession = spyOn(auth.api, "getSession");

const { facilitiesRoutes } = await import("../../src/modules/facilities/facilities.routes");

const facility: Facility = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "HCM-01",
  name: "Ho Chi Minh facility",
  address: "123 Nguyen Hue",
  description: null,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const unitType: UnitType = {
  id: "22222222-2222-4222-8222-222222222222",
  code: "SMALL",
  name: "Small storage",
  sizeLabel: "S",
  lengthM: 2,
  widthM: 3,
  heightM: 4,
  sizeCbm: 24,
  monthlyPrice: 500_000,
  isActive: true,
  createdAt: new Date("2026-01-03T00:00:00.000Z"),
  updatedAt: new Date("2026-01-04T00:00:00.000Z"),
};

const getFacilities = spyOn(FacilitiesRepository.prototype, "getAllFacilities");
const findFacility = spyOn(FacilitiesRepository.prototype, "findById");
const getUnitTypes = spyOn(FacilityUnitTypesRepository.prototype, "listByFacility");
const app = Fastify();

beforeAll(async () => {
  // Repositories are mocked; no database client or connection is needed.
  app.decorate("db", {});
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  setupErrorHandler(app);
  await app.register(facilitiesRoutes, { prefix: "/api/facilities" });
  await app.ready();
});

beforeEach(() => {
  getSession.mockImplementation(() => {
    throw new Error("Public facility routes must not require a session");
  });
  getFacilities.mockClear().mockResolvedValue([facility]);
  findFacility.mockClear().mockResolvedValue(facility);
  getUnitTypes.mockClear().mockResolvedValue([unitType]);
});

afterAll(async () => {
  await app.close();
  getFacilities.mockRestore();
  findFacility.mockRestore();
  getUnitTypes.mockRestore();
  getSession.mockRestore();
});

const invalidQueries = [
  "limit=0",
  "limit=101",
  "limit=1.5",
  "limit=abc",
  "offset=-1",
  "offset=1.5",
  "offset=abc",
];

describe("GET /api/facilities", () => {
  test("returns facilities without authentication using default pagination and active filter", async () => {
    const response = await app.inject({ method: "GET", url: "/api/facilities" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBeUndefined();
    expect(response.json()).toEqual({
      success: true,
      data: [
        {
          ...facility,
          createdAt: facility.createdAt.toISOString(),
          updatedAt: facility.updatedAt.toISOString(),
        },
      ],
      timestamp: expect.any(String),
    });
    expect(getFacilities).toHaveBeenCalledTimes(1);
    expect(getFacilities).toHaveBeenCalledWith(20, 0, true);
    expect(findFacility).not.toHaveBeenCalled();
    expect(getUnitTypes).not.toHaveBeenCalled();
  });

  test("passes numeric pagination to the repository", async () => {
    const response = await app.inject({ method: "GET", url: "/api/facilities?limit=2&offset=3" });

    expect(response.statusCode).toBe(200);
    expect(getFacilities).toHaveBeenCalledWith(2, 3, true);
  });

  test("returns an empty array when there are no matching facilities", async () => {
    getFacilities.mockResolvedValue([]);
    const response = await app.inject({ method: "GET", url: "/api/facilities" });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual([]);
  });

  test.each(invalidQueries)(
    "rejects invalid query %s before querying the repository",
    async (query) => {
      const response = await app.inject({ method: "GET", url: `/api/facilities?${query}` });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        success: false,
        error: { code: 400 },
      });
      expect(getFacilities).not.toHaveBeenCalled();
    },
  );
});

describe("GET /api/facilities/:facilityId/unit-types", () => {
  const url = `/api/facilities/${facility.id}/unit-types`;

  test("returns unit types without authentication and serializes dates and numeric dimensions", async () => {
    const response = await app.inject({ method: "GET", url });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      data: [
        {
          ...unitType,
          createdAt: unitType.createdAt.toISOString(),
          updatedAt: unitType.updatedAt.toISOString(),
        },
      ],
      timestamp: expect.any(String),
    });
    expect(findFacility).toHaveBeenCalledTimes(1);
    expect(findFacility).toHaveBeenCalledWith(facility.id);
    expect(getUnitTypes).toHaveBeenCalledTimes(1);
    expect(getUnitTypes).toHaveBeenCalledWith(facility.id, 20, 0);
    expect(getFacilities).not.toHaveBeenCalled();
  });

  test("passes facility ID and numeric pagination to the repository", async () => {
    const response = await app.inject({ method: "GET", url: `${url}?limit=5&offset=2` });

    expect(response.statusCode).toBe(200);
    expect(getUnitTypes).toHaveBeenCalledWith(facility.id, 5, 2);
  });

  test("returns an empty array for an active facility without unit types", async () => {
    getUnitTypes.mockResolvedValue([]);
    const response = await app.inject({ method: "GET", url });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual([]);
  });

  test.each(["missing", "inactive"])(
    "returns 404 for a %s facility without querying unit types",
    async (state) => {
      findFacility.mockResolvedValue(
        state === "missing" ? undefined : { ...facility, isActive: false },
      );
      const response = await app.inject({ method: "GET", url });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        success: false,
        error: { code: 404, message: UNIT_TYPE_MESSAGES.facilityUnavailable },
      });
      expect(getUnitTypes).not.toHaveBeenCalled();
    },
  );

  test("rejects an invalid facility UUID before querying repositories", async () => {
    const response = await app.inject({ method: "GET", url: "/api/facilities/invalid/unit-types" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ success: false, error: { code: 400 } });
    expect(findFacility).not.toHaveBeenCalled();
    expect(getUnitTypes).not.toHaveBeenCalled();
  });

  test.each(invalidQueries)(
    "rejects invalid query %s before querying repositories",
    async (query) => {
      const response = await app.inject({ method: "GET", url: `${url}?${query}` });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        success: false,
        error: { code: 400 },
      });
      expect(findFacility).not.toHaveBeenCalled();
      expect(getUnitTypes).not.toHaveBeenCalled();
    },
  );
});
