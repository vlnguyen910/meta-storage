import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  bookings,
  checkInSlots,
  db,
  eq,
  facilityAssignments,
  facilityTasks,
  inArray,
  queryClient,
} from "@metastorage/database";
import { swaggerPlugin } from "../../src/common/plugins/swagger";
import { facilityTasksRoutes } from "../../src/modules/facility-tasks/facility-tasks.routes";
import { createFacilityOperationsFixture } from "../fixtures/facility-operations";

describe.skipIf(!process.env.MY_STORAGE_LOCAL_DATABASE_URL)("Flow 5 manual facility tasks", () => {
  let f: Awaited<ReturnType<typeof createFacilityOperationsFixture>>;
  const slotId = randomUUID(),
    bookingId = randomUUID(),
    otherBookingId = randomUUID();
  beforeAll(async () => {
    f = await createFacilityOperationsFixture();
    await f.app.register(swaggerPlugin);
    await f.app.register(facilityTasksRoutes, { prefix: "/api/facility-tasks" });
    await f.login();
    await db
      .insert(checkInSlots)
      .values({ id: slotId, name: slotId, startTime: "09:00", endTime: "10:30" });
    await db.insert(bookings).values(
      [bookingId, otherBookingId].map((id) => ({
        id,
        facilityId: id === bookingId ? f.facilityId : f.otherFacilityId,
        unitTypeId: id === bookingId ? f.typeId : f.foreignTypeId,
        requestedMonths: 1,
        checkInDate: "2032-01-01",
        checkInSlotId: slotId,
        rentalEndAt: new Date("2032-02-01"),
        monthlyRateSnapshot: "1000000",
        rentalFeeAmount: "1000000",
        depositAmount: "1000000",
        totalAmount: "2000000",
        status: "CONFIRMED" as const,
        contactName: "Task customer",
        contactEmail: "task@example.test",
        contactPhone: "0900000000",
        assignedStaffId: f.ids.staff,
      })),
    );
  });
  afterAll(async () => {
    try {
      if (f) {
        await db
          .delete(facilityTasks)
          .where(inArray(facilityTasks.facilityId, [f.facilityId, f.otherFacilityId]));
        await db.delete(bookings).where(inArray(bookings.id, [bookingId, otherBookingId]));
        await db.delete(checkInSlots).where(eq(checkInSlots.id, slotId));
        await f.cleanup();
      }
    } finally {
      await queryClient.end();
    }
  });
  function input(overrides: Record<string, unknown> = {}) {
    return {
      facilityId: f.facilityId,
      assignedStaffId: f.ids.staff,
      type: "INSPECT_UNIT",
      title: "Kiểm tra kho trước bàn giao",
      storageUnitId: f.unitId,
      ...overrides,
    };
  }
  test("OpenAPI documents session auth and the actual creation/conflict HTTP statuses", async () => {
    const r = await f.app.inject("/docs/json");
    expect(r.statusCode).toBe(200);
    const paths = r.json().paths;
    expect(paths["/api/facility-tasks/"].post.responses).toHaveProperty("201");
    expect(paths["/api/facility-tasks/"].post.responses).not.toHaveProperty("200");
    expect(
      paths["/api/facility-tasks/"].post.responses["201"].content["application/json"].schema
        .example,
    ).toMatchObject({ success: true, data: { type: "INSPECT_UNIT", version: 0 } });
    expect(paths["/api/facility-tasks/"].post.security).toEqual([{ sessionAuth: [] }]);
    expect(paths["/api/facility-tasks/{id}/assign"].post.responses).toHaveProperty("409");
  });
  async function create(overrides: Record<string, unknown> = {}) {
    const r = await f.api("manager", "POST", "/facility-tasks", input(overrides));
    expect(r.statusCode).toBe(201);
    return r.json().data;
  }
  test("only the assigned FM can create; all task types persist with server actor metadata", async () => {
    expect((await f.api(null, "POST", "/facility-tasks", input())).statusCode).toBe(401);
    for (const actor of ["staff", "customer", "otherManager", "admin", "bom"] as const) {
      expect((await f.api(actor, "POST", "/facility-tasks", input())).statusCode).toBe(403);
    }
    for (const type of ["INSPECT_UNIT", "PRINT_DOCUMENT", "REPORT_TO_MANAGER"]) {
      const task = await create({ type, bookingId });
      expect(task).toMatchObject({
        facilityId: f.facilityId,
        assignedStaffId: f.ids.staff,
        assignedBy: f.ids.manager,
        createdBy: f.ids.manager,
        type,
        version: 0,
        bookingId,
        storageUnitId: f.unitId,
      });
      expect(typeof task.assignedAt).toBe("string");
      const [saved] = await db.select().from(facilityTasks).where(eq(facilityTasks.id, task.id));
      expect(saved?.assignedStaffId).toBe(f.ids.staff);
      // Assignment metadata alone never grants authority or changes occupancy/booking assignments.
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
      expect(booking?.assignedStaffId).toBe(f.ids.staff);
      expect(booking?.status).toBe("CONFIRMED");
    }
  });
  test("rejects unavailable staff and cross-facility context without inserting a task", async () => {
    const before = await db.select({ id: facilityTasks.id }).from(facilityTasks);
    for (const assignedStaffId of [
      f.ids.otherStaff,
      f.ids.expiredStaff,
      f.ids.inactiveStaff,
      f.ids.customer,
      randomUUID(),
    ]) {
      expect(
        (await f.api("manager", "POST", "/facility-tasks", input({ assignedStaffId }))).statusCode,
      ).toBe(400);
    }
    for (const overrides of [
      { storageUnitId: f.otherUnitId },
      { storageUnitId: randomUUID() },
      { bookingId: otherBookingId },
      { bookingId: randomUUID() },
    ]) {
      expect((await f.api("manager", "POST", "/facility-tasks", input(overrides))).statusCode).toBe(
        400,
      );
    }
    expect(await db.select({ id: facilityTasks.id }).from(facilityTasks)).toHaveLength(
      before.length,
    );
  });
  test("validates task input and cannot spoof the assigner or mutate an unrelated field", async () => {
    for (const overrides of [
      { title: " " },
      { title: "x".repeat(201) },
      { type: "MAINTENANCE" },
      { assignedBy: f.ids.admin },
      { assignedStaffId: "bad" },
      { version: -1 },
    ]) {
      expect((await f.api("manager", "POST", "/facility-tasks", input(overrides))).statusCode).toBe(
        400,
      );
    }
  });
  test("FM sees facility tasks; staff sees only their own with filters and pagination", async () => {
    const own = await create({ title: "Own", type: "REPORT_TO_MANAGER" });
    const peer = await create({
      title: "Peer",
      assignedStaffId: f.ids.peerStaff,
      type: "REPORT_TO_MANAGER",
    });
    const path = `/facility-tasks?facilityId=${f.facilityId}&type=REPORT_TO_MANAGER`;
    const manager = await f.api("manager", "GET", `${path}&limit=1&offset=0`);
    expect(manager.statusCode).toBe(200);
    expect(manager.json().data.items).toHaveLength(1);
    expect(manager.json().data.total).toBeGreaterThanOrEqual(2);
    const staff = await f.api("staff", "GET", path);
    expect(staff.statusCode).toBe(200);
    expect(staff.json().data.items.some((t: { id: string }) => t.id === own.id)).toBe(true);
    expect(staff.json().data.items.some((t: { id: string }) => t.id === peer.id)).toBe(false);
    expect(
      staff
        .json()
        .data.items.every((t: { assignedStaffId: string }) => t.assignedStaffId === f.ids.staff),
    ).toBe(true);
    expect(
      (await f.api("staff", "GET", `${path}&assignedStaffId=${f.ids.peerStaff}`)).statusCode,
    ).toBe(403);
    expect((await f.api("otherManager", "GET", path)).statusCode).toBe(403);
    expect((await f.api("customer", "GET", path)).statusCode).toBe(403);
    expect((await f.api(null, "GET", path)).statusCode).toBe(401);
  });
  test("detail requires current facility scope and the assigned staff member", async () => {
    const task = await create();
    for (const who of ["manager", "staff"] as const) {
      const r = await f.api(who, "GET", `/facility-tasks/${task.id}`);
      expect(r.statusCode).toBe(200);
      expect(r.json().data).toMatchObject({
        id: task.id,
        assignedStaffName: "staff",
        assignerName: "manager",
      });
      expect(r.json().data).not.toHaveProperty("password");
    }
    for (const who of [
      "peerStaff",
      "otherStaff",
      "otherManager",
      "customer",
      "admin",
      "bom",
    ] as const)
      expect((await f.api(who, "GET", `/facility-tasks/${task.id}`)).statusCode).toBe(403);
    expect((await f.api("manager", "GET", `/facility-tasks/${randomUUID()}`)).statusCode).toBe(404);
    await db
      .update(facilityAssignments)
      .set({ endedAt: new Date("2000-01-01") })
      .where(eq(facilityAssignments.userId, f.ids.staff));
    try {
      expect((await f.api("staff", "GET", `/facility-tasks/${task.id}`)).statusCode).toBe(403);
    } finally {
      await db
        .update(facilityAssignments)
        .set({ endedAt: null })
        .where(eq(facilityAssignments.userId, f.ids.staff));
    }
  });
  test("reassignment is FM-only, scoped, versioned and retry-safe", async () => {
    const task = await create();
    const path = `/facility-tasks/${task.id}/assign`;
    const payload = { assignedStaffId: f.ids.peerStaff, version: 0 };
    expect((await f.api("staff", "POST", path, payload)).statusCode).toBe(403);
    expect((await f.api("otherManager", "POST", path, payload)).statusCode).toBe(403);
    expect(
      (await f.api("manager", "POST", path, { assignedStaffId: f.ids.otherStaff, version: 0 }))
        .statusCode,
    ).toBe(400);
    const changed = await f.api("manager", "POST", path, payload);
    expect(changed.statusCode).toBe(200);
    expect(changed.json().data).toMatchObject({ assignedStaffId: f.ids.peerStaff, version: 1 });
    expect((await f.api("manager", "POST", path, payload)).statusCode).toBe(409);
    const retry = await f.api("manager", "POST", path, { ...payload, version: 1 });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().data.version).toBe(1);
    expect((await f.api("staff", "GET", `/facility-tasks/${task.id}`)).statusCode).toBe(403);
    expect((await f.api("peerStaff", "GET", `/facility-tasks/${task.id}`)).statusCode).toBe(200);
  });
  test("competing reassignments cannot both overwrite the same version", async () => {
    const task = await create();
    const responses = await Promise.all(
      [1, 2].map(() =>
        f.api("manager", "POST", `/facility-tasks/${task.id}/assign`, {
          assignedStaffId: f.ids.peerStaff,
          version: 0,
        }),
      ),
    );
    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const [saved] = await db.select().from(facilityTasks).where(eq(facilityTasks.id, task.id));
    expect(saved?.version).toBe(1);
    expect(saved?.assignedStaffId).toBe(f.ids.peerStaff);
  });
});
