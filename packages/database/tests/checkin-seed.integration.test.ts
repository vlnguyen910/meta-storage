import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const target = process.env.SEED_TEST_DATABASE_URL;
let database: typeof import("../src/index");
let fixtures: typeof import("../src/seed");
let seedImmediateCheckInSlot: typeof import("../src/seed").seedImmediateCheckInSlot;
let service: import("../../../apps/api/src/modules/check-ins/check-ins.service").CheckInsService;
let now = new Date("2026-10-23T07:00:30Z");
let bookingId: string;

describe.skipIf(!target)("immediate check-in seed on an isolated database", () => {
  beforeAll(async () => {
    assert(target);
    const url = new URL(target);
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !url.pathname.endsWith("_seed_test")
    ) {
      throw new Error("Use a dedicated loopback database ending in _seed_test");
    }
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = target;
    fixtures = await import("../src/seed");
    bookingId = fixtures.SEED_IDS.demoCheckInBooking;
    database = await import("../src/index");
    if ((await database.db.select().from(database.bookings).limit(1)).length) {
      throw new Error("Seed regression requires a freshly migrated empty test database");
    }
    const child = Bun.spawn([process.execPath, "run", "db:seed"], {
      cwd: fileURLToPath(new URL("../../..", import.meta.url)),
      env: { ...globalThis.process.env, SEED_NOW: now.toISOString() },
      stdout: "ignore",
      stderr: "inherit",
    });
    expect(await child.exited).toBe(0);
    ({ seedImmediateCheckInSlot } = await import("../src/seed"));
    const { CheckInsService } = await import(
      "../../../apps/api/src/modules/check-ins/check-ins.service"
    );
    const { CheckInsRepository } = await import(
      "../../../apps/api/src/modules/check-ins/check-ins.repository"
    );
    service = new CheckInsService(new CheckInsRepository(database.db), () => now);
  });
  afterAll(async () => {
    await database?.queryClient.end();
  });

  test("bundled API fixture imports cannot execute the seed", async () => {
    const directory = await mkdtemp(join(tmpdir(), "metastorage-seed-import-"));
    try {
      const result = await Bun.build({
        entrypoints: [
          fileURLToPath(new URL("../../../apps/api/src/dev/auth-fixtures.ts", import.meta.url)),
        ],
        target: "bun",
      });
      expect(result.success).toBe(true);
      const output = result.outputs[0];
      assert(output);
      const file = join(directory, "api-fixtures.mjs");
      await writeFile(file, await output.text());
      const child = Bun.spawn([process.execPath, file], {
        env: process.env,
        stdout: "pipe",
        stderr: "pipe",
      });
      const stdout = await new Response(child.stdout).text();
      const stderr = await new Response(child.stderr).text();
      expect(await child.exited).toBe(0);
      expect(stdout).toBe("");
      expect(stderr).toBe("");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("is immediately eligible and keeps allocation dates aligned", async () => {
    const result = await service.lookup({ type: "BOOKING_CODE", value: "DEMO-CHECKIN-NOW" });
    expect(result.eligibility).toEqual({ canProceed: true, reasons: [] });
    expect(Date.parse(result.booking.checkInSlotStart)).toBeLessThanOrEqual(now.getTime());
    expect(
      Date.parse(result.booking.rentalEndAt) - Date.parse(result.booking.checkInSlotStart),
    ).toBe(30 * 24 * 60 * 60 * 1000);
    const { db, capacityAllocations, eq } = database;
    const [allocation] = await db
      .select()
      .from(capacityAllocations)
      .where(eq(capacityAllocations.referenceId, bookingId));
    assert(allocation);
    expect(allocation.startsAt.toISOString()).toBe(result.booking.checkInSlotStart);
    expect(allocation.endsAt.toISOString()).toBe(result.booking.rentalEndAt);
  });
  test("refreshes on rerun, including late evening, without duplicating slots", async () => {
    const { SEED_IDS } = fixtures;
    const { db, bookings, checkInSlots, eq } = database;
    const originals = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, SEED_IDS.bookings["BK-2026-0001"]));
    now = new Date("2026-10-23T16:59:30Z");
    await seedImmediateCheckInSlot(now);
    await seedImmediateCheckInSlot(now);
    const result = await service.lookup({ type: "BOOKING_CODE", value: "DEMO-CHECKIN-NOW" });
    expect(result.eligibility.canProceed).toBe(true);
    expect(result.booking.checkInSlotStart).toBe("2026-10-23T16:59:00.000Z");
    expect(
      await db.select().from(bookings).where(eq(bookings.id, SEED_IDS.bookings["BK-2026-0001"])),
    ).toEqual(originals);
    expect(
      await db.select().from(checkInSlots).where(eq(checkInSlots.id, SEED_IDS.demoCheckInSlot)),
    ).toHaveLength(1);
  });
  test("preserves the demo booking and slot after verification", async () => {
    const { SEED_USERS } = fixtures;
    await service.confirm(bookingId, SEED_USERS[1].id);
    const { db, bookings, checkInSlots, eq } = database;
    const [before] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    assert(before);
    const [slot] = await db
      .select()
      .from(checkInSlots)
      .where(eq(checkInSlots.id, before.checkInSlotId));
    assert(slot);
    now = new Date("2026-10-24T00:30:00Z");
    await seedImmediateCheckInSlot(now);
    expect(await db.select().from(bookings).where(eq(bookings.id, bookingId))).toEqual([before]);
    expect(await db.select().from(checkInSlots).where(eq(checkInSlots.id, slot.id))).toEqual([
      slot,
    ]);
  });
});
