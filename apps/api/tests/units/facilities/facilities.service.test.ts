import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictError, NotFoundError } from "../../../src/common/errors/app-error";
import type { FacilitiesRepository } from "../../../src/modules/facilities/facilities.repository";
import { FacilitiesService } from "../../../src/modules/facilities/facilities.service";

describe("facilities service", () => {
  it("throws ConflictError when creating a facility with an existing code", async () => {
    const mockFacilitiesRepo = {
      findByCode: async (code: string) => ({
        id: "1",
        code,
        name: "Test",
        address: "Address",
        coverUrl: null,
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as unknown as FacilitiesRepository;

    const service = new FacilitiesService(mockFacilitiesRepo);

    await assert.rejects(
      () =>
        service.createFacility({
          code: "EXISTING",
          name: "Test Facility",
          address: "123 Street",
        }),
      ConflictError,
    );
  });

  it("throws NotFoundError when the facility is not accessible", async () => {
    const mockFacilitiesRepo = {
      findAccessibleById: async () => undefined,
    } as unknown as FacilitiesRepository;

    const service = new FacilitiesService(mockFacilitiesRepo);

    await assert.rejects(
      () =>
        service.getFacilityById("00000000-0000-0000-0000-000000000000", {
          kind: "global",
          userId: "00000000-0000-0000-0000-000000000001",
          role: "SYSTEM_ADMIN",
        }),
      NotFoundError,
    );
  });
});
