import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { InspectionRecordSchema } from "@metastorage/contracts";
import {
  and,
  appointments,
  db,
  eq,
  facilityAssignments,
  facilityTasks,
  inspections,
  queryClient,
} from "@metastorage/database";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { authPlugin } from "../../src/modules/auth/auth.guard";
import { authRoutes } from "../../src/modules/auth/auth.routes";
import { inspectionsRoutes } from "../../src/modules/inspections/inspections.routes";
import { createInspectionFixture } from "../fixtures/inspection-fixture";

describe.skipIf(process.env.RUN_INSPECTION_DB_TESTS !== "1")(
  "appointment inspection history authorization on migrated PostgreSQL",
  () => {
    const app = Fastify();
    let fixture: Awaited<ReturnType<typeof createInspectionFixture>>;
    let other: Awaited<ReturnType<typeof createInspectionFixture>>;
    let managerCookie = "";
    let staffCookie = "";
    let previousStaffCookie = "";
    let otherManagerCookie = "";
    let otherStaffCookie = "";
    let customerCookie = "";
    const currentInspectionId = randomUUID();
    const previousInspectionId = randomUUID();

    async function login(email: string) {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        payload: { email, password: fixture.password },
      });
      expect(response.statusCode).toBe(200);
      return response.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    }

    function history(cookie: string, bookingId = fixture.bookingId) {
      return app.inject({
        method: "GET",
        url: `/api/inspections/appointments/${bookingId}`,
        headers: { cookie },
      });
    }

    beforeAll(async () => {
      fixture = await createInspectionFixture();
      other = await createInspectionFixture();
      for (const [inspectionId, staffId] of [
        [currentInspectionId, fixture.userId],
        [previousInspectionId, fixture.outsiderId],
      ]) {
        const [task] = await db
          .insert(facilityTasks)
          .values({
            facilityId: fixture.facilityId,
            type: "CHECK_IN_HANDOVER",
            referenceType: "APPOINTMENT",
            referenceId: fixture.bookingId,
            assignedStaffId: fixture.userId,
            assignedBy: fixture.managerId,
          })
          .returning();
        if (!task) throw new Error("Missing inspection task fixture");
        await db.insert(inspections).values({
          id: inspectionId,
          storageUnitId: fixture.unitId,
          reservationId: fixture.bookingId,
          inspectedBy: staffId,
          taskId: task.id,
          inspectionType: "CHECK_IN",
          notes: "History remains visible to the facility manager after reassignment",
        });
      }
      await db
        .update(appointments)
        .set({ assignedStaffId: fixture.userId })
        .where(eq(appointments.id, fixture.bookingId));
      app.decorate("db", db);
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);
      setupErrorHandler(app);
      await app.register(authPlugin);
      await app.register(authRoutes, { prefix: "/api/auth" });
      await app.register(inspectionsRoutes, { prefix: "/api" });
      await app.ready();
      managerCookie = await login(fixture.managerEmail);
      staffCookie = await login(fixture.email);
      previousStaffCookie = await login(fixture.outsiderEmail);
      otherManagerCookie = await login(other.managerEmail);
      otherStaffCookie = await login(other.email);
      customerCookie = await login(fixture.customerEmail);
    });

    afterAll(async () => {
      try {
        await app.close();
        if (fixture) await fixture.cleanup();
        if (other) await other.cleanup();
      } finally {
        await queryClient.end();
      }
    });

    test("FM reads both current and previous staff inspections using the current contract", async () => {
      const response = await history(managerCookie);
      expect(response.statusCode).toBe(200);
      const records = response.json().data;
      expect(records).toHaveLength(2);
      expect(records.map((record: { id: string }) => record.id).sort()).toEqual(
        [currentInspectionId, previousInspectionId].sort(),
      );
      for (const record of records) {
        expect(InspectionRecordSchema.safeParse(record).success).toBe(true);
        expect(record.reservationId).toBe(fixture.bookingId);
        expect(record.facilityId).toBe(fixture.facilityId);
        expect(record.storageUnitId).toBe(fixture.unitId);
      }
    });

    test("assigned FS reads the appointment inspections", async () => {
      const response = await history(staffCookie);
      expect(response.statusCode).toBe(200);
      expect(response.json().data.map((record: { id: string }) => record.id)).toEqual([
        expect.any(String),
        expect.any(String),
      ]);
    });

    test("previous FS loses access even with an inspection they performed", async () => {
      expect((await history(previousStaffCookie)).statusCode).toBe(403);
    });

    test("FM and FS from another facility cannot read the appointment history", async () => {
      expect((await history(otherManagerCookie)).statusCode).toBe(403);
      expect((await history(otherStaffCookie)).statusCode).toBe(403);
    });

    test("customer and anonymous requests cannot read the internal history", async () => {
      expect((await history(customerCookie)).statusCode).toBe(403);
      expect((await history("")).statusCode).toBe(401);
    });

    test("FM gets an empty list when the appointment has no inspection", async () => {
      const response = await history(otherManagerCookie, other.bookingId);
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual([]);
    });

    test("FM can view history before a staff member has been assigned", async () => {
      await db
        .update(appointments)
        .set({ assignedStaffId: null })
        .where(eq(appointments.id, fixture.bookingId));
      try {
        const response = await history(managerCookie);
        expect(response.statusCode).toBe(200);
        expect(response.json().data).toHaveLength(2);
        expect((await history(staffCookie)).statusCode).toBe(403);
      } finally {
        await db
          .update(appointments)
          .set({ assignedStaffId: fixture.userId })
          .where(eq(appointments.id, fixture.bookingId));
      }
    });

    test("revoking facility membership blocks a previously logged-in FM", async () => {
      const membership = and(
        eq(facilityAssignments.userId, fixture.managerId),
        eq(facilityAssignments.facilityId, fixture.facilityId),
      );
      await db.update(facilityAssignments).set({ isActive: false }).where(membership);
      try {
        expect((await history(managerCookie)).statusCode).toBe(403);
      } finally {
        await db.update(facilityAssignments).set({ isActive: true }).where(membership);
      }
    });

    test("read access does not allow FM to start, update or hand over an inspection", async () => {
      for (const [method, url, payload] of [
        ["POST", "/api/inspections", { taskId: randomUUID() }],
        ["PATCH", `/api/inspections/${currentInspectionId}`, { notes: "FM cannot edit" }],
        [
          "POST",
          `/api/inspections/${currentInspectionId}/handover`,
          { customerReceivedUnit: true },
        ],
      ] as const) {
        const response = await app.inject({
          method,
          url,
          headers: { cookie: managerCookie },
          payload,
        });
        expect(response.statusCode).toBe(403);
      }
    });

    test("missing appointments return 404 and malformed identifiers return 400", async () => {
      expect((await history(managerCookie, randomUUID())).statusCode).toBe(404);
      expect((await history(managerCookie, "invalid-booking")).statusCode).toBe(400);
    });
  },
);
