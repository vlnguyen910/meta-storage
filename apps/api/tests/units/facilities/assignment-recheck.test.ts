import { describe, expect, it } from "bun:test";
import type { Database } from "@metastorage/database";
import { FacilityAssignmentsRepository } from "../../../src/modules/facilities/facility-assignments.repository";

const userId = "18500000-0000-4000-8000-000000000001";
const facilityId = "18500000-0000-4000-8000-000000000002";

describe("assignment target recheck", () => {
  it("rejects a stale role/status even if the service checked ACTIVE earlier", async () => {
    for (const current of [
      { id: userId, role: "FACILITY_STAFF", status: "INACTIVE" },
      { id: userId, role: "CUSTOMER", status: "ACTIVE" },
    ]) {
      let inserted = false;
      const tx = {
        select: () => ({ from: () => ({ where: () => ({ for: async () => [current] }) }) }),
        insert: () => {
          inserted = true;
          throw new Error("must not insert");
        },
      };
      const db = {
        transaction: async (work: (connection: typeof tx) => Promise<unknown>) => work(tx),
      } as unknown as Database;
      await expect(
        new FacilityAssignmentsRepository(db).upsertAssignment({
          userId,
          facilityId,
          role: "FACILITY_STAFF",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(inserted).toBe(false);
    }
  });
});
