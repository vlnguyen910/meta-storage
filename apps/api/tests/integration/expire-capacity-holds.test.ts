import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  capacityAllocations,
  db,
  eq,
  facilities,
  facilityUnitTypes,
  sql,
  unitTypes,
} from "@metastorage/database";
import Fastify from "fastify";
import fp from "fastify-plugin";
import {
  CAPACITY_HOLD_EXPIRY_LOCK,
  expireCapacityHolds,
} from "../../src/common/cron/expire-capacity-holds";
import { cronPlugin } from "../../src/common/cron/plugin";

const testUrl = process.env.BOOKING_TEST_DATABASE_URL;
const facilityId = randomUUID();
const unitTypeId = randomUUID();
const now = new Date("2030-01-01T00:00:00Z");
let fixturesCreated = false;

describe.skipIf(!testUrl)("Capacity hold expiry with PostgreSQL", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV !== "test" || process.env.DATABASE_URL !== testUrl)
      throw new Error(
        "Use NODE_ENV=test and DATABASE_URL matching isolated BOOKING_TEST_DATABASE_URL",
      );
    await db.transaction(async (tx) => {
      await tx.insert(facilities).values({
        id: facilityId,
        code: facilityId,
        name: "Expiry test",
        address: "Test",
      });
      await tx.insert(unitTypes).values({
        id: unitTypeId,
        code: unitTypeId,
        name: "Expiry test",
        sizeLabel: "S",
        lengthM: 1,
        widthM: 1,
        heightM: 1,
        monthlyPrice: 1000000,
      });
      await tx.insert(facilityUnitTypes).values({ facilityId, unitTypeId });
    });
    fixturesCreated = true;
  });

  beforeEach(async () => {
    await db.delete(capacityAllocations).where(eq(capacityAllocations.facilityId, facilityId));
  });

  afterAll(async () => {
    if (!fixturesCreated) return;
    await db.transaction(async (tx) => {
      await tx.delete(capacityAllocations).where(eq(capacityAllocations.facilityId, facilityId));
      await tx.delete(facilityUnitTypes).where(eq(facilityUnitTypes.facilityId, facilityId));
      await tx.delete(facilities).where(eq(facilities.id, facilityId));
      await tx.delete(unitTypes).where(eq(unitTypes.id, unitTypeId));
    });
  });

  test("expires only overdue active holds, including the boundary, and is idempotent", async () => {
    const cases = [
      {
        kind: "HOLD",
        status: "ACTIVE",
        expiresAt: new Date(now.getTime() - 1),
        expected: "EXPIRED",
      },
      { kind: "HOLD", status: "ACTIVE", expiresAt: now, expected: "EXPIRED" },
      {
        kind: "HOLD",
        status: "ACTIVE",
        expiresAt: new Date(now.getTime() + 1),
        expected: "ACTIVE",
      },
      { kind: "HOLD", status: "ACTIVE", expiresAt: null, expected: "ACTIVE" },
      { kind: "BOOKING", status: "ACTIVE", expiresAt: now, expected: "ACTIVE" },
      { kind: "HOLD", status: "RELEASED", expiresAt: now, expected: "RELEASED" },
      { kind: "HOLD", status: "EXPIRED", expiresAt: now, expected: "EXPIRED" },
    ] as const;
    const ids = cases.map(() => randomUUID());
    const unchangedAt = new Date("2029-01-01T00:00:00Z");
    await db.insert(capacityAllocations).values(
      cases.map((item, index) => ({
        id: ids[index],
        facilityId,
        unitTypeId,
        referenceId: randomUUID(),
        kind: item.kind,
        status: item.status,
        expiresAt: item.expiresAt,
        startsAt: now,
        endsAt: new Date("2030-02-01T00:00:00Z"),
        updatedAt: unchangedAt,
      })),
    );
    expect(await expireCapacityHolds(db, now)).toEqual({ expired: 2, skipped: false });
    const rows = await db
      .select()
      .from(capacityAllocations)
      .where(eq(capacityAllocations.facilityId, facilityId));
    for (const [index, item] of cases.entries()) {
      const row = rows.find((allocation) => allocation.id === ids[index]);
      expect(row?.status).toBe(item.expected);
      expect(row?.updatedAt).toEqual(index < 2 ? now : unchangedAt);
    }
    expect(await expireCapacityHolds(db, now)).toEqual({ expired: 0, skipped: false });
  });

  test("skips overlapping sweeps and acquires the lock again after rollback", async () => {
    const rollback = new Error("Release lock through rollback");
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${CAPACITY_HOLD_EXPIRY_LOCK[0]}::integer, ${CAPACITY_HOLD_EXPIRY_LOCK[1]}::integer)`,
        );
        expect(await expireCapacityHolds(db, now)).toEqual({ expired: 0, skipped: true });
        throw rollback;
      }),
    ).rejects.toThrow(rollback.message);
    expect(await expireCapacityHolds(db, now)).toEqual({ expired: 0, skipped: false });
  });

  test("API cron expires holds on startup and on its next scheduled run without Redis", async () => {
    const id = randomUUID();
    await db.insert(capacityAllocations).values({
      id,
      facilityId,
      unitTypeId,
      referenceId: randomUUID(),
      kind: "HOLD",
      startsAt: new Date("2020-01-01T00:00:00Z"),
      endsAt: new Date("2020-02-01T00:00:00Z"),
      expiresAt: new Date("2020-01-01T00:00:00Z"),
    });
    // Deliberately register no Redis plugin/client: the cron only depends on DB.
    const app = Fastify();
    app.register(
      fp(
        async (instance) => {
          instance.decorate("db", db);
        },
        { name: "database-plugin" },
      ),
    );
    app.register(cronPlugin);
    try {
      await app.ready();
      const [row] = await db
        .select()
        .from(capacityAllocations)
        .where(eq(capacityAllocations.id, id));
      expect(row?.status).toBe("EXPIRED");
      await db
        .update(capacityAllocations)
        .set({ status: "ACTIVE" })
        .where(eq(capacityAllocations.id, id));
      const deadline = Date.now() + 33_000;
      let status = "ACTIVE";
      while (status === "ACTIVE" && Date.now() < deadline) {
        await Bun.sleep(100);
        const [allocation] = await db
          .select()
          .from(capacityAllocations)
          .where(eq(capacityAllocations.id, id));
        status = allocation?.status ?? "missing";
      }
      expect(status).toBe("EXPIRED");
    } finally {
      await app.close();
    }
  }, 35_000);
});
