import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { db, eq, facilityAssignments, facilityTasks, users } from "@metastorage/database";
import { facilityTasksRoutes } from "../../src/modules/facility-tasks/facility-tasks.routes";
import { createFacilityOperationsFixture } from "../fixtures/facility-operations";

describe.skipIf(!process.env.MY_STORAGE_LOCAL_DATABASE_URL)("staff task detail", () => {
  let f: Awaited<ReturnType<typeof createFacilityOperationsFixture>>;
  const taskId = randomUUID();
  beforeAll(async () => {
    f = await createFacilityOperationsFixture();
    await f.app.register(facilityTasksRoutes, { prefix: "/api/facility-tasks" });
    await db.insert(facilityTasks).values({
      id: taskId,
      facilityId: f.facilityId,
      type: "UNIT_INSPECTION",
      referenceType: "STORAGE_UNIT",
      referenceId: f.unitId,
      assignedStaffId: f.ids.staff,
      assignedBy: f.ids.manager,
    });
    await f.login();
  });
  afterAll(async () => {
    if (!f) return;
    await db.delete(facilityTasks).where(eq(facilityTasks.id, taskId));
    await f.cleanup();
  });
  test("returns the same detail as the scoped list and rejects other actors", async () => {
    const detail = await f.api("staff", "GET", `/facility-tasks/my/${taskId}`);
    const list = await f.api("staff", "GET", "/facility-tasks/my");
    expect(detail.statusCode, detail.body).toBe(200);
    expect(detail.json().data).toEqual(
      list.json().data.items.find((t: { id: string }) => t.id === taskId),
    );
    expect(detail.headers["cache-control"]).toBe("private, no-store");
    for (const actor of ["peerStaff", "otherStaff"] as const)
      expect((await f.api(actor, "GET", `/facility-tasks/my/${taskId}`)).statusCode).toBe(404);
    for (const actor of ["manager", "customer", "expiredStaff"] as const)
      expect((await f.api(actor, "GET", `/facility-tasks/my/${taskId}`)).statusCode).toBe(403);
    expect((await f.api(null, "GET", `/facility-tasks/my/${taskId}`)).statusCode).toBe(401);
    expect((await f.api("staff", "GET", "/facility-tasks/my/invalid")).statusCode).toBe(400);
    expect((await f.api("staff", "GET", `/facility-tasks/my/${randomUUID()}`)).statusCode).toBe(
      404,
    );
    await db.update(users).set({ status: "INACTIVE" }).where(eq(users.id, f.ids.staff));
    try {
      expect((await f.api("staff", "GET", `/facility-tasks/my/${taskId}`)).statusCode).toBe(403);
    } finally {
      await db.update(users).set({ status: "ACTIVE" }).where(eq(users.id, f.ids.staff));
    }
  });
  test("keeps closed tasks readable until the facility assignment is revoked", async () => {
    await db.update(facilityTasks).set({ status: "CANCELLED" }).where(eq(facilityTasks.id, taskId));
    expect((await f.api("staff", "GET", `/facility-tasks/my/${taskId}`)).json().data.status).toBe(
      "CANCELLED",
    );
    await db
      .update(facilityAssignments)
      .set({ isActive: false })
      .where(eq(facilityAssignments.userId, f.ids.staff));
    expect((await f.api("staff", "GET", `/facility-tasks/my/${taskId}`)).statusCode).toBe(403);
  });
});
