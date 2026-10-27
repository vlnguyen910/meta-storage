import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  db,
  eq,
  facilityAssignments,
  facilityTasks,
  inArray,
  queryClient,
  storageUnits,
  users,
} from "@metastorage/database";
import { swaggerPlugin } from "../../src/common/plugins/swagger";
import { facilityTasksRoutes } from "../../src/modules/facility-tasks/facility-tasks.routes";
import { createFacilityOperationsFixture } from "../fixtures/facility-operations";

describe.skipIf(!process.env.MY_STORAGE_LOCAL_DATABASE_URL)("Flow 5 task reports", () => {
  let f: Awaited<ReturnType<typeof createFacilityOperationsFixture>>;
  const taskIds: string[] = [];
  beforeAll(async () => {
    f = await createFacilityOperationsFixture();
    await f.app.register(swaggerPlugin);
    await f.app.register(facilityTasksRoutes, { prefix: "/api/facility-tasks" });
    await f.login();
  });
  afterAll(async () => {
    try {
      if (f) {
        if (taskIds.length) {
          await db.delete(facilityTasks).where(inArray(facilityTasks.id, taskIds));
        }
        await f.cleanup();
      }
    } finally {
      await queryClient.end();
    }
  });
  async function create() {
    const r = await f.api("manager", "POST", "/facility-tasks", {
      facilityId: f.facilityId,
      assignedStaffId: f.ids.staff,
      type: "INSPECT_UNIT",
      title: "Inspect unit",
      storageUnitId: f.unitId,
    });
    expect(r.statusCode).toBe(201);
    const task = r.json().data;
    taskIds.push(task.id);
    return task;
  }
  const path = (id: string) => `/facility-tasks/${id}/reports`;
  const start = (id: string) => f.api("staff", "POST", `/facility-tasks/${id}/start`);

  test("FS starts and reports; only FM acceptance completes the task", async () => {
    const task = await create();
    expect((await start(task.id)).statusCode).toBe(200);
    const before = await db.select().from(facilityTasks).where(eq(facilityTasks.id, task.id));
    const originalTask = before[0];
    if (!originalTask) throw new Error("Created task was not persisted");
    const unitBefore = await db.select().from(storageUnits).where(eq(storageUnits.id, f.unitId));
    let firstReportId = "";
    for (const content of [" First inspection ", "Follow-up inspection"]) {
      const r = await f.api("staff", "POST", path(task.id), { content });
      expect(r.statusCode).toBe(201);
      if (!firstReportId) firstReportId = r.json().data.id;
      expect(r.json().data).toMatchObject({
        taskId: task.id,
        submittedBy: f.ids.staff,
        submitterName: "staff",
        content: content.trim(),
      });
      expect(Object.keys(r.json().data).sort()).toEqual(
        [
          "id",
          "taskId",
          "submittedBy",
          "submitterName",
          "content",
          "submittedAt",
          "acceptedBy",
          "acceptedByName",
          "acceptedAt",
        ].sort(),
      );
      const [saved] = await db.select().from(facilityTasks).where(eq(facilityTasks.id, task.id));
      expect(saved?.reportId).toBe(r.json().data.id);
      expect(saved?.reportContent).toBe(content.trim());
      expect(saved?.reportSubmittedAt?.toISOString()).toBe(r.json().data.submittedAt);
    }
    const history = await f.api("manager", "GET", path(task.id));
    expect(history.statusCode).toBe(200);
    expect(history.headers["cache-control"]).toBe("private, no-store");
    expect(history.json().data).toMatchObject({ total: 1, limit: 20, offset: 0 });
    expect(history.json().data.items.map((r: { content: string }) => r.content)).toEqual([
      "Follow-up inspection",
    ]);
    const [waiting] = await db.select().from(facilityTasks).where(eq(facilityTasks.id, task.id));
    expect(waiting?.status).toBe("AWAITING_APPROVAL");
    expect(waiting?.completedAt).toBeNull();
    expect(waiting?.updatedAt.getTime()).toBeGreaterThanOrEqual(originalTask.updatedAt.getTime());
    expect(await db.select().from(storageUnits).where(eq(storageUnits.id, f.unitId))).toEqual(
      unitBefore,
    );
    const latest = history.json().data.items[0];
    expect(
      (await f.api("manager", "POST", `${path(task.id)}/${firstReportId}/accept`)).statusCode,
    ).toBe(409);
    const accepted = await f.api("manager", "POST", `${path(task.id)}/${latest.id}/accept`);
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().data).toMatchObject({
      id: task.id,
      status: "COMPLETED",
      completedBy: f.ids.manager,
    });
    const [acceptedTask] = await db
      .select()
      .from(facilityTasks)
      .where(eq(facilityTasks.id, task.id));
    expect(acceptedTask?.completedBy).toBe(f.ids.manager);
    expect(acceptedTask?.completedAt).toBeInstanceOf(Date);
    expect((await start(task.id)).statusCode).toBe(409);
    expect((await f.api("staff", "POST", path(task.id), { content: "Too late" })).statusCode).toBe(
      409,
    );
  });

  test("rejects other actors, cross-facility access and spoofed report fields", async () => {
    const task = await create();
    expect((await f.api(null, "POST", path(task.id), { content: "Report" })).statusCode).toBe(401);
    expect((await f.api(null, "GET", path(task.id))).statusCode).toBe(401);
    for (const actor of [
      "manager",
      "otherManager",
      "peerStaff",
      "otherStaff",
      "customer",
      "admin",
      "bom",
      "expiredStaff",
    ] as const) {
      expect((await f.api(actor, "POST", path(task.id), { content: "Report" })).statusCode).toBe(
        403,
      );
    }
    for (const actor of [
      "otherManager",
      "peerStaff",
      "otherStaff",
      "customer",
      "admin",
      "bom",
    ] as const) {
      expect((await f.api(actor, "GET", path(task.id))).statusCode).toBe(403);
    }
    for (const body of [
      { content: " " },
      { content: "x".repeat(5001) },
      {},
      { content: "Report", submittedBy: f.ids.peerStaff },
      { content: "Report", submittedAt: new Date().toISOString() },
      { content: "Report", status: "COMPLETED" },
    ]) {
      expect((await f.api("staff", "POST", path(task.id), body)).statusCode).toBe(400);
    }
    const [unreported] = await db.select().from(facilityTasks).where(eq(facilityTasks.id, task.id));
    expect(unreported?.reportId).toBeNull();
    for (const method of ["POST", "GET"] as const) {
      expect(
        (
          await f.api(
            "staff",
            method,
            path(randomUUID()),
            method === "POST" ? { content: "Report" } : undefined,
          )
        ).statusCode,
      ).toBe(404);
    }
  });

  test("revoked or expired membership blocks submission and history; disabled account cannot submit", async () => {
    const task = await create();
    expect((await start(task.id)).statusCode).toBe(200);
    for (const change of [{ isActive: false }, { endedAt: new Date("2000-01-01") }]) {
      await db
        .update(facilityAssignments)
        .set(change)
        .where(eq(facilityAssignments.userId, f.ids.staff));
      try {
        expect(
          (await f.api("staff", "POST", path(task.id), { content: "Report" })).statusCode,
        ).toBe(403);
        expect((await f.api("staff", "GET", path(task.id))).statusCode).toBe(403);
      } finally {
        await db
          .update(facilityAssignments)
          .set({ isActive: true, endedAt: null })
          .where(eq(facilityAssignments.userId, f.ids.staff));
      }
    }
    await db
      .update(facilityAssignments)
      .set({ isActive: false })
      .where(eq(facilityAssignments.userId, f.ids.manager));
    try {
      expect((await f.api("manager", "GET", path(task.id))).statusCode).toBe(403);
    } finally {
      await db
        .update(facilityAssignments)
        .set({ isActive: true })
        .where(eq(facilityAssignments.userId, f.ids.manager));
    }
    await db.update(users).set({ status: "INACTIVE" }).where(eq(users.id, f.ids.staff));
    try {
      expect((await f.api("staff", "POST", path(task.id), { content: "Report" })).statusCode).toBe(
        403,
      );
    } finally {
      await db.update(users).set({ status: "ACTIVE" }).where(eq(users.id, f.ids.staff));
    }
  });

  test("reassignment preserves the current report until the new assignee replaces it", async () => {
    const task = await create();
    expect((await start(task.id)).statusCode).toBe(200);
    expect(
      (await f.api("staff", "POST", path(task.id), { content: "Original staff" })).statusCode,
    ).toBe(201);
    expect(
      (
        await f.api("manager", "POST", `/facility-tasks/${task.id}/assign`, {
          assignedStaffId: f.ids.peerStaff,
          version: 0,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await f.api("staff", "POST", path(task.id), { content: "Late report" })).statusCode,
    ).toBe(403);
    expect((await f.api("staff", "GET", path(task.id))).statusCode).toBe(403);
    expect(
      (await f.api("peerStaff", "POST", path(task.id), { content: "New staff" })).statusCode,
    ).toBe(201);
    for (const actor of ["manager", "peerStaff"] as const) {
      const r = await f.api(actor, "GET", path(task.id));
      expect(r.statusCode).toBe(200);
      expect(r.json().data.items.map((v: { submittedBy: string }) => v.submittedBy)).toEqual([
        f.ids.peerStaff,
      ]);
    }
  });

  test("report list returns only the latest submission with compatible pagination", async () => {
    const task = await create();
    expect((await start(task.id)).statusCode).toBe(200);
    expect((await f.api("manager", "GET", path(task.id))).json().data).toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    const reports = await Promise.all(
      [1, 2, 3].map((i) => f.api("staff", "POST", path(task.id), { content: `Report ${i}` })),
    );
    expect(reports.every((r) => r.statusCode === 201)).toBe(true);
    const all = (await f.api("manager", "GET", path(task.id))).json().data;
    const page = (await f.api("manager", "GET", `${path(task.id)}?limit=1&offset=1`)).json().data;
    expect(all.total).toBe(1);
    expect(all.items).toHaveLength(1);
    expect(page).toEqual({ items: [], total: 1, limit: 1, offset: 1 });
    expect((await f.api("manager", "GET", `${path(task.id)}?offset=100`)).json().data).toEqual({
      items: [],
      total: 1,
      limit: 20,
      offset: 100,
    });
    for (const query of ["limit=0", "limit=101", "offset=-1", `submittedBy=${f.ids.staff}`]) {
      expect((await f.api("manager", "GET", `${path(task.id)}?${query}`)).statusCode).toBe(400);
    }
  });

  test("concurrent report and reassignment serialize without attributing a report to the new staff", async () => {
    const task = await create();
    expect((await start(task.id)).statusCode).toBe(200);
    const [report, assignment] = await Promise.all([
      f.api("staff", "POST", path(task.id), { content: "Racing report" }),
      f.api("manager", "POST", `/facility-tasks/${task.id}/assign`, {
        assignedStaffId: f.ids.peerStaff,
        version: 0,
      }),
    ]);
    expect(assignment.statusCode).toBe(200);
    expect([201, 403]).toContain(report.statusCode);
    const [saved] = await db.select().from(facilityTasks).where(eq(facilityTasks.id, task.id));
    expect(saved?.reportId !== null).toBe(report.statusCode === 201);
    if (saved?.reportId) expect(saved.reportSubmittedBy).toBe(f.ids.staff);
    expect(
      (await f.api("staff", "POST", path(task.id), { content: "After assignment" })).statusCode,
    ).toBe(403);
  });

  test("OpenAPI exposes authenticated report endpoints with correct envelopes and statuses", async () => {
    const r = await f.app.inject("/docs/json");
    expect(r.statusCode).toBe(200);
    const route = r.json().paths["/api/facility-tasks/{id}/reports"];
    expect(route.post.security).toEqual([{ sessionAuth: [] }]);
    expect(route.post.responses).toHaveProperty("201");
    expect(route.post.responses).toHaveProperty("404");
    expect(
      route.get.responses["200"].content["application/json"].schema.example.data,
    ).toHaveProperty("items");
  });
});
