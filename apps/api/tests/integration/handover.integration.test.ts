import { expect, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { passingChecklist } from "../fixtures/inspection-fixture";

test.skipIf(process.env.RUN_INSPECTION_DB_TESTS !== "1")(
  "assigned Staff handover is authorized, atomic and idempotent",
  async () => {
    const { assertIsolatedDatabase, createInspectionFixture } = await import(
      "../fixtures/inspection-fixture"
    );
    assertIsolatedDatabase(true);
    const { CloudinaryPhotoStorage } = await import(
      "../../src/common/adapters/storage/cloudinary-photo.storage"
    );
    const photoSpies = [
      spyOn(CloudinaryPhotoStorage.prototype, "upload").mockImplementation(async () => ({
        publicId: `test/${randomUUID()}`,
        format: "png",
      })),
      spyOn(CloudinaryPhotoStorage.prototype, "readUrl").mockImplementation(
        (id) => `https://evidence.example.test/${id}`,
      ),
      spyOn(CloudinaryPhotoStorage.prototype, "remove").mockResolvedValue(undefined),
    ];
    const {
      db,
      eq,
      bookings,
      checkInVerifications,
      rentals,
      storageUnits,
      payments,
      handoverInspections,
    } = await import("@metastorage/database");
    const f = await createInspectionFixture(true);
    const fixtures = [f];
    // Use real routes/auth/DB, but no global cron, queue, worker or Redis writes.
    const { default: Fastify } = await import("fastify");
    const { serializerCompiler, validatorCompiler } = await import("fastify-type-provider-zod");
    const { setupErrorHandler } = await import("../../src/common/errors/error-handler");
    const { authPlugin } = await import("../../src/modules/auth/auth.guard");
    const { authRoutes } = await import("../../src/modules/auth/auth.routes");
    const { bookingsRoutes } = await import("../../src/modules/bookings/bookings.routes");
    const { checkInsRoutes } = await import("../../src/modules/check-ins/check-ins.routes");
    const { inspectionsRoutes } = await import("../../src/modules/inspections/inspections.routes");
    const { facilityContextPlugin } = await import("../../src/modules/facilities/facilities.guard");
    const app = Fastify();
    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    await app.register(authPlugin);
    await app.register(authRoutes, { prefix: "/api/auth" });
    await app.register(facilityContextPlugin);
    await app.register(bookingsRoutes, { prefix: "/api" });
    await app.register(checkInsRoutes, { prefix: "/api" });
    await app.register(inspectionsRoutes, { prefix: "/api" });
    await app.ready();
    const origin = process.env.AUTH_TRUSTED_ORIGINS?.split(",")[0] ?? "http://localhost:3000";
    async function login(email: string) {
      const r = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: { origin },
        payload: { email, password: f.password },
      });
      expect(r.statusCode).toBe(200);
      const cookie = r.headers["set-cookie"];
      return (Array.isArray(cookie) ? cookie : [cookie ?? ""])
        .map((c) => c.split(";")[0])
        .join("; ");
    }
    const staff = await login(f.email),
      manager = await login(f.managerEmail),
      other = await login(f.outsiderEmail);
    const request = (
      cookie: string,
      method: "GET" | "POST" | "PATCH",
      path: string,
      payload?: object,
    ) =>
      app.inject({
        method,
        url: `/api${path}`,
        headers: { cookie, origin },
        ...(payload ? { payload } : {}),
      });
    try {
      for (const cookie of [manager, other]) {
        expect(
          (await request(cookie, "POST", `/check-ins/${f.bookingId}/confirm`)).statusCode,
        ).toBe(403);
        expect(
          (await request(cookie, "POST", `/bookings/${f.bookingId}/inspections`)).statusCode,
        ).toBe(403);
      }
      expect(
        (
          await request(other, "POST", "/check-ins/lookup", {
            type: "BOOKING_CODE",
            value: f.bookingCode,
          })
        ).statusCode,
      ).toBe(403);
      expect((await request(staff, "POST", `/check-ins/${f.bookingId}/confirm`)).statusCode).toBe(
        200,
      );
      const start = await request(staff, "POST", `/bookings/${f.bookingId}/inspections`);
      expect(start.statusCode).toBe(200);
      let record = start.json().data;
      const id = record.id;
      expect((await request(manager, "GET", `/inspections/${id}`)).statusCode).toBe(200);
      for (const cookie of [manager, other]) {
        expect(
          (
            await request(cookie, "PATCH", `/inspections/${id}`, {
              version: 0,
              correctUnit: true,
              conditionNotes: "test",
            })
          ).statusCode,
        ).toBe(403);
        expect(
          (await request(cookie, "POST", `/inspections/${id}/complete`, { version: 0 })).statusCode,
        ).toBe(403);
        expect(
          (await request(cookie, "POST", `/inspections/${id}/handover`, { version: 0 })).statusCode,
        ).toBe(403);
      }
      expect(
        (await request(staff, "POST", `/inspections/${id}/handover`, { version: 0 })).statusCode,
      ).toBe(409);
      record = (
        await request(staff, "PATCH", `/inspections/${id}`, {
          version: 0,
          correctUnit: true,
          conditionNotes: "",
          results: passingChecklist,
        })
      ).json().data;
      expect(record.photos).toHaveLength(0);
      expect(record.conditionNotes).toBe("");
      const complete = await request(staff, "POST", `/inspections/${id}/complete`, {
        version: record.version,
      });
      expect(complete.statusCode).toBe(200);
      const beforeHandover = await request(manager, "GET", `/facilities/${f.facilityId}/bookings`);
      expect(beforeHandover.json().data[0].handoverStage).toBe("READY_HANDOVER");
      record = complete.json().data;
      expect(
        await db.select().from(rentals).where(eq(rentals.bookingId, f.bookingId)),
      ).toHaveLength(0);
      expect(
        (await request(staff, "POST", `/inspections/${id}/handover`, { version: 0 })).statusCode,
      ).toBe(409);
      await db
        .update(payments)
        .set({ status: "FAILED" })
        .where(eq(payments.bookingId, f.bookingId));
      expect(
        (await request(staff, "POST", `/inspections/${id}/handover`, { version: record.version }))
          .statusCode,
      ).toBe(409);
      expect(
        await db.select().from(rentals).where(eq(rentals.bookingId, f.bookingId)),
      ).toHaveLength(0);
      await db
        .update(payments)
        .set({ status: "SUCCEEDED" })
        .where(eq(payments.bookingId, f.bookingId));
      await db
        .update(storageUnits)
        .set({ status: "MAINTENANCE" })
        .where(eq(storageUnits.id, f.unitId));
      expect(
        (await request(staff, "POST", `/inspections/${id}/handover`, { version: record.version }))
          .statusCode,
      ).toBe(409);
      expect(
        await db.select().from(rentals).where(eq(rentals.bookingId, f.bookingId)),
      ).toHaveLength(0);
      await db
        .update(storageUnits)
        .set({ status: "RESERVED" })
        .where(eq(storageUnits.id, f.unitId));
      const responses = await Promise.all([
        request(staff, "POST", `/inspections/${id}/handover`, { version: record.version }),
        request(staff, "POST", `/inspections/${id}/handover`, { version: record.version }),
      ]);
      expect(responses.map((r) => r.statusCode)).toEqual([200, 200]);
      expect(responses[0]?.json().data.handedOverByName).toBe("Assigned Staff");
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, f.bookingId));
      const active = await db.select().from(rentals).where(eq(rentals.bookingId, f.bookingId));
      expect(active).toHaveLength(1);
      expect(active[0]?.status).toBe("ACTIVE");
      const { InspectionsRepository } = await import(
        "../../src/modules/inspections/inspections.repository"
      );
      const booked = await new InspectionsRepository(db).booking(f.bookingId);
      expect(active[0]?.startAt.toISOString()).toBe(booked?.checkInSlotStart.toISOString());
      expect(active[0]?.expectedEndAt.toISOString()).toBe(booking?.rentalEndAt.toISOString());
      expect(active[0]?.depositAmount).toBe(booking?.depositAmount);
      expect(booking?.status).toBe("CHECKED_IN");
      const afterHandover = await request(manager, "GET", `/facilities/${f.facilityId}/bookings`);
      expect(afterHandover.json().data[0].handoverStage).toBe("HANDED_OVER");
      const [unit] = await db.select().from(storageUnits).where(eq(storageUnits.id, f.unitId));
      expect(unit?.status).toBe("OCCUPIED");
      const [v] = await db
        .select()
        .from(checkInVerifications)
        .where(eq(checkInVerifications.id, f.verificationId));
      expect(v?.status).toBe("CONSUMED");
      const [inspection] = await db
        .select()
        .from(handoverInspections)
        .where(eq(handoverInspections.id, id));
      expect(inspection?.handedOverBy).toBe(f.userId);
      expect(inspection?.handedOverAt).not.toBeNull();
      const lookup = await request(staff, "POST", "/check-ins/lookup", {
        type: "BOOKING_CODE",
        value: f.bookingCode,
      });
      expect(lookup.json().data.verification.status).toBe("CONSUMED");
      expect(
        (
          await request(manager, "POST", `/bookings/${f.bookingId}/assign-staff`, {
            staffId: f.outsiderId,
          })
        ).statusCode,
      ).toBe(409);
      const second = await createInspectionFixture(true);
      fixtures.push(second);
      const secondManager = await login(second.managerEmail),
        secondStaff = await login(second.email);
      expect(
        (
          await request(secondManager, "POST", `/bookings/${second.bookingId}/assign-staff`, {
            staffId: second.outsiderId,
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (await request(secondStaff, "POST", `/check-ins/${second.bookingId}/confirm`)).statusCode,
      ).toBe(403);
      const [old] = await db
        .select()
        .from(checkInVerifications)
        .where(eq(checkInVerifications.id, second.verificationId));
      expect(old?.status).toBe("INVALIDATED");
    } finally {
      await app.close();
      for (const spy of photoSpies) spy.mockRestore();
      for (const fixture of fixtures.reverse()) await fixture.cleanup();
      const { queryClient } = await import("@metastorage/database");
      await queryClient.end();
    }
  },
  30000,
);
