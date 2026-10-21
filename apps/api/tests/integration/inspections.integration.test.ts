import { expect, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { passingChecklist } from "../fixtures/inspection-fixture";

// Explicit opt-in: normal CI unit tests never connect to a developer database.
test.skipIf(process.env.RUN_INSPECTION_DB_TESTS !== "1")(
  "inspection API persists, validates, scopes and locks the baseline",
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
    const { default: Fastify } = await import("fastify");
    const { serializerCompiler, validatorCompiler } = await import("fastify-type-provider-zod");
    const { setupErrorHandler } = await import("../../src/common/errors/error-handler");
    const { authPlugin } = await import("../../src/modules/auth/auth.guard");
    const { authRoutes } = await import("../../src/modules/auth/auth.routes");
    const { inspectionsRoutes } = await import("../../src/modules/inspections/inspections.routes");
    const { db, eq, bookings, checkInVerifications, rentals, handoverInspections } = await import(
      "@metastorage/database"
    );
    const fixture = await createInspectionFixture(true);
    // Test only these routes; never start the global scheduler on a developer DB.
    const app = Fastify();
    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    app.register(authPlugin);
    app.register(authRoutes, { prefix: "/api/auth" });
    app.register(inspectionsRoutes, { prefix: "/api" });
    await app.ready();
    const origin = process.env.AUTH_TRUSTED_ORIGINS?.split(",")[0] ?? "http://localhost:3000";
    async function login(email: string) {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: { origin },
        payload: { email, password: fixture.password },
      });
      expect(response.statusCode).toBe(200);
      const raw = response.headers["set-cookie"];
      return (Array.isArray(raw) ? raw : [raw ?? ""]).map((c) => c.split(";")[0]).join("; ");
    }
    const cookie = await login(fixture.email),
      outsideCookie = await login(fixture.outsiderEmail);
    async function request(
      method: "GET" | "POST" | "PATCH" | "DELETE",
      url: string,
      payload?: unknown,
      session = cookie,
    ) {
      return app.inject({
        method,
        url: `/api${url}`,
        headers: { cookie: session, origin },
        ...(payload ? { payload: payload as object } : {}),
      });
    }
    try {
      expect(
        (
          await app.inject({
            method: "POST",
            url: `/api/bookings/${fixture.bookingId}/inspections`,
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await request(
            "POST",
            `/bookings/${fixture.bookingId}/inspections`,
            undefined,
            outsideCookie,
          )
        ).statusCode,
      ).toBe(403);
      const start = await request("POST", `/bookings/${fixture.bookingId}/inspections`);
      expect(start.statusCode).toBe(200);
      let record = start.json().data;
      const id = record.id;
      expect(
        (await request("POST", `/bookings/${fixture.bookingId}/inspections`)).json().data.id,
      ).toBe(id);
      expect(
        (await request("POST", `/inspections/${id}/complete`, { version: 0 })).statusCode,
      ).toBe(422);
      const input = {
        version: 0,
        correctUnit: true,
        conditionNotes: "Tường có vết xước sẵn — baseline",
      };
      const competing = await Promise.all([
        request("PATCH", `/inspections/${id}`, input),
        request("PATCH", `/inspections/${id}`, input),
      ]);
      expect(competing.map((r) => r.statusCode).sort()).toEqual([200, 409]);
      record = competing.find((r) => r.statusCode === 200)?.json().data;
      expect(
        (await request("POST", `/inspections/${id}/complete`, { version: record.version }))
          .statusCode,
      ).toBe(422);
      const dataBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5ZkAAAAASUVORK5CYII=";
      const uploaded = await request("POST", `/inspections/${id}/photos`, {
        version: record.version,
        filename: "baseline.png",
        mimeType: "image/png",
        dataBase64,
      });
      expect(uploaded.statusCode).toBe(200);
      record = uploaded.json().data;
      const photoId = record.photos[0].id;
      expect(record.photos[0].dataBase64).toBeUndefined();
      expect(
        (await request("GET", `/inspections/${id}/photos/${photoId}`, undefined, outsideCookie))
          .statusCode,
      ).toBe(403);
      expect(
        (await request("GET", `/inspections/${id}/photos/${photoId}`)).json().data.url,
      ).toContain("https://evidence.example.test/");
      // Enforce the technical storage bound without affecting completion requirements.
      for (let i = 1; i < 8; i++) {
        const response = await request("POST", `/inspections/${id}/photos`, {
          version: record.version,
          filename: `baseline-${i}.png`,
          mimeType: "image/png",
          dataBase64,
        });
        expect(response.statusCode).toBe(200);
        record = response.json().data;
      }
      expect(
        (
          await request("POST", `/inspections/${id}/photos`, {
            version: record.version,
            filename: "overflow.png",
            mimeType: "image/png",
            dataBase64,
          })
        ).statusCode,
      ).toBe(422);
      expect(
        (await request("GET", `/inspections/${id}/photos/00000000-0000-4000-8000-000000000001`))
          .statusCode,
      ).toBe(404);
      for (const results of [
        passingChecklist.slice(1),
        passingChecklist.map((r, i) => (i === 1 ? { ...r, result: "FAIL" } : r)),
      ]) {
        const saved = await request("PATCH", `/inspections/${id}`, {
          ...input,
          version: record.version,
          results,
        });
        expect(saved.statusCode).toBe(200);
        record = saved.json().data;
        expect(
          (await request("POST", `/inspections/${id}/complete`, { version: record.version }))
            .statusCode,
        ).toBe(422);
      }
      for (const results of [
        [...passingChecklist, passingChecklist[0]],
        [{ ...passingChecklist[0], itemCode: "UNKNOWN" }],
      ]) {
        expect(
          (
            await request("PATCH", `/inspections/${id}`, {
              ...input,
              version: record.version,
              results,
            })
          ).statusCode,
        ).toBe(400);
      }
      record = (
        await request("PATCH", `/inspections/${id}`, {
          ...input,
          version: record.version,
          results: passingChecklist,
        })
      ).json().data;
      expect(record.results).toEqual(passingChecklist);
      expect(record.checklistDefinition).toHaveLength(4);
      expect(record.checklistVersion).toBe("H6_4PASS_V1");
      expect((await request("GET", `/inspections/${id}`)).json().data.results).toEqual(
        passingChecklist,
      );
      const completed = await request("POST", `/inspections/${id}/complete`, {
        version: record.version,
      });
      expect(completed.statusCode).toBe(200);
      expect(completed.json().data.status).toBe("COMPLETED");
      expect(
        (await request("POST", `/inspections/${id}/complete`, { version: record.version })).json()
          .data.completedAt,
      ).toBe(completed.json().data.completedAt);
      expect(
        (
          await request("PATCH", `/inspections/${id}`, {
            ...input,
            version: completed.json().data.version,
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await request("DELETE", `/inspections/${id}/photos/${photoId}`, {
            version: completed.json().data.version,
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (await db.select().from(bookings).where(eq(bookings.id, fixture.bookingId)))[0]?.status,
      ).toBe("CONFIRMED");
      expect(
        await db.select().from(rentals).where(eq(rentals.bookingId, fixture.bookingId)),
      ).toHaveLength(0);
      await db
        .update(checkInVerifications)
        .set({ status: "INVALIDATED" })
        .where(eq(checkInVerifications.id, fixture.verificationId));
      expect((await request("POST", `/bookings/${fixture.bookingId}/inspections`)).statusCode).toBe(
        409,
      );
      expect((await request("GET", `/inspections/${id}`)).json().data.status).toBe("COMPLETED");
      // A new verification creates a new draft, never reuses the immutable old evidence.
      await db.insert(checkInVerifications).values({
        bookingId: fixture.bookingId,
        facilityId: fixture.facilityId,
        staffId: fixture.userId,
        unitAssignmentId: fixture.assignmentId,
      });
      const fresh = await request("POST", `/bookings/${fixture.bookingId}/inspections`);
      expect(fresh.statusCode).toBe(200);
      expect(fresh.json().data.id).not.toBe(id);
      expect(fresh.json().data.photos).toHaveLength(0);
      expect(fresh.json().data.correctUnit).toBeNull();
      expect(fresh.json().data.results).toEqual([]);
      // Nullable metadata represents old completed evidence, never synthesized PASS results.
      await db
        .update(handoverInspections)
        .set({
          checklistVersion: null,
          checklistResults: null,
          checklistDefinition: null,
          status: "COMPLETED",
          completedAt: new Date(),
          completedBy: fixture.userId,
        })
        .where(eq(handoverInspections.id, fresh.json().data.id));
      const historical = (await request("GET", `/inspections/${fresh.json().data.id}`)).json().data;
      expect(historical.results).toBeNull();
      expect(historical.checklistDefinition).toBeNull();
      expect(historical.status).toBe("COMPLETED");
      await db
        .update(bookings)
        .set({ status: "NO_SHOW" })
        .where(eq(bookings.id, fixture.bookingId));
      expect(
        (await request("PATCH", `/inspections/${fresh.json().data.id}`, { ...input, version: 0 }))
          .statusCode,
      ).toBe(409);
    } finally {
      await app.close();
      for (const spy of photoSpies) spy.mockRestore();
      await fixture.cleanup();
      const { queryClient } = await import("@metastorage/database");
      await queryClient.end();
    }
  },
  30000,
);
