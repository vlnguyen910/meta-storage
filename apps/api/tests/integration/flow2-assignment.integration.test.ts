import { expect, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";

test.skipIf(process.env.RUN_INSPECTION_DB_TESTS !== "1")(
  "FM reserves exclusively, retries safely, reassigns and releases on cancel/no-show",
  async () => {
    const { assertIsolatedDatabase, createInspectionFixture } = await import(
      "../fixtures/inspection-fixture"
    );
    assertIsolatedDatabase();
    const { db, bookings, payments, storageUnits, unitAssignments, checkInVerifications, and, eq } =
      await import("@metastorage/database");
    const { closeBookingBeforeCheckIn } = await import(
      "../../src/modules/bookings/bookings.repository"
    );
    const { buildApp } = await import("../../src/app");
    const f = await createInspectionFixture();
    const app = buildApp();
    await app.ready();
    try {
      const origin = process.env.AUTH_TRUSTED_ORIGINS?.split(",")[0] ?? "http://localhost:3000";
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: { origin },
        payload: { email: f.managerEmail, password: f.password },
      });
      expect(login.statusCode).toBe(200);
      const cookies = login.headers["set-cookie"];
      const cookie = (Array.isArray(cookies) ? cookies : [cookies ?? ""])
        .map((c) => c.split(";")[0])
        .join("; ");
      const assign = (bookingId: string, unitId: string, headers = { cookie, origin }) =>
        app.inject({
          method: "POST",
          url: `/api/bookings/${bookingId}/assign-unit`,
          headers,
          payload: { physicalUnitId: unitId },
        });
      const unitStatus = async (id: string) =>
        (await db.select().from(storageUnits).where(eq(storageUnits.id, id)))[0]?.status;
      const [original] = await db.select().from(bookings).where(eq(bookings.id, f.bookingId));
      const [payment] = await db.select().from(payments).where(eq(payments.bookingId, f.bookingId));
      if (!original || !payment) throw new Error("Missing fixture");
      const nextId = randomUUID();
      const accessToken = createHash("sha256").update(randomUUID()).digest("hex");
      const accessTokenHash = createHash("sha256").update(accessToken).digest("hex");
      await db.update(bookings).set({ accessTokenHash }).where(eq(bookings.id, f.bookingId));
      await db.insert(bookings).values({
        ...original,
        id: nextId,
        bookingCode: `BK-${randomUUID()}`,
        checkInDate: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
        accessTokenHash,
      });
      await db.insert(payments).values({
        ...payment,
        id: randomUUID(),
        bookingId: nextId,
        paymentCode: randomUUID().replaceAll("-", ""),
        idempotencyKey: randomUUID(),
        providerPaymentId: randomUUID(),
      });
      await db
        .update(unitAssignments)
        .set({ status: "CANCELLED" })
        .where(eq(unitAssignments.id, f.assignmentId));
      await db
        .update(storageUnits)
        .set({ status: "AVAILABLE" })
        .where(eq(storageUnits.id, f.unitId));
      expect((await assign(f.bookingId, f.unitId, { cookie: "", origin })).statusCode).toBe(401);
      const responses = await Promise.all([
        assign(f.bookingId, f.unitId),
        assign(nextId, f.unitId),
      ]);
      expect(responses.filter((r) => r.statusCode === 200)).toHaveLength(1);
      const winner = responses[0]?.statusCode === 200 ? f.bookingId : nextId;
      const loser = winner === f.bookingId ? nextId : f.bookingId;
      expect(await unitStatus(f.unitId)).toBe("RESERVED");
      const assigned = responses.find((r) => r.statusCode === 200)?.json().data;
      expect((await assign(winner, f.unitId)).json().data.id).toBe(assigned.id);
      expect((await assign(loser, f.unitId)).statusCode).toBe(400);
      const eligible = await app.inject({
        method: "GET",
        url: `/api/bookings/${loser}/eligible-units`,
        headers: { cookie, origin },
      });
      expect(
        eligible.json().data.find((u: { id: string }) => u.id === f.unitId).isAvailableForPeriod,
      ).toBe(false);
      const replacement = randomUUID();
      await db.insert(storageUnits).values({
        id: replacement,
        facilityId: f.facilityId,
        unitTypeId: original.unitTypeId,
        code: `REPLACE-${randomUUID()}`,
      });
      expect((await assign(winner, replacement)).statusCode).toBe(200);
      expect(await unitStatus(f.unitId)).toBe("AVAILABLE");
      expect(await unitStatus(replacement)).toBe("RESERVED");
      expect(
        await db
          .select()
          .from(unitAssignments)
          .where(and(eq(unitAssignments.bookingId, winner), eq(unitAssignments.status, "ACTIVE"))),
      ).toHaveLength(1);
      expect(
        (
          await db
            .select()
            .from(checkInVerifications)
            .where(eq(checkInVerifications.id, f.verificationId))
        )[0]?.status,
      ).toBe("INVALIDATED");
      const cancellation = await app.inject({
        method: "POST",
        url: `/api/bookings/${winner}/cancel`,
        headers: { origin, "x-booking-access-token": accessToken },
      });
      expect(cancellation.statusCode).toBe(200);
      expect(await unitStatus(replacement)).toBe("AVAILABLE");
      const [refund] = await db.select().from(payments).where(eq(payments.bookingId, winner));
      expect(refund?.status).toBe("REFUND_PENDING");
      expect(Number(refund?.refundAmount)).toBe(Number(original.rentalFeeAmount));
      expect(Number(refund?.depositForfeitedAmount)).toBe(Number(original.depositAmount));

      await db
        .update(storageUnits)
        .set({ status: "OCCUPIED" })
        .where(eq(storageUnits.id, replacement));
      expect((await assign(loser, replacement)).statusCode).toBe(400);
      expect(await unitStatus(replacement)).toBe("OCCUPIED");
      const noShow = await createInspectionFixture();
      expect((await assign(noShow.bookingId, noShow.unitId)).statusCode).toBe(403);
      await db
        .update(bookings)
        .set({ checkInDate: new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10) })
        .where(eq(bookings.id, noShow.bookingId));
      await db.transaction(async (tx) => {
        expect(
          await closeBookingBeforeCheckIn(tx, noShow.bookingId, "NO_SHOW", new Date()),
        ).not.toBeNull();
      });
      expect(await unitStatus(noShow.unitId)).toBe("AVAILABLE");
      const protectedUnit = await createInspectionFixture();
      await db
        .update(storageUnits)
        .set({ status: "MAINTENANCE" })
        .where(eq(storageUnits.id, protectedUnit.unitId));
      await db.transaction(async (tx) => {
        expect(
          await closeBookingBeforeCheckIn(tx, protectedUnit.bookingId, "CANCELLED", new Date()),
        ).not.toBeNull();
      });
      expect(await unitStatus(protectedUnit.unitId)).toBe("MAINTENANCE");
      // Historical overlapping assignments must not be accidentally freed by cancellation.
      const shared = await createInspectionFixture();
      const [sharedBooking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, shared.bookingId));
      if (!sharedBooking) throw new Error("Missing shared fixture");
      const sharedOtherId = randomUUID();
      await db
        .insert(bookings)
        .values({ ...sharedBooking, id: sharedOtherId, bookingCode: `BK-${randomUUID()}` });
      await db.insert(unitAssignments).values({
        bookingId: sharedOtherId,
        physicalUnitId: shared.unitId,
        assignedBy: shared.managerId,
        status: "ACTIVE",
      });
      await db.transaction(async (tx) => {
        expect(
          await closeBookingBeforeCheckIn(tx, shared.bookingId, "CANCELLED", new Date()),
        ).not.toBeNull();
      });
      expect(await unitStatus(shared.unitId)).toBe("RESERVED");
    } finally {
      await app.close();
    }
  },
  30_000,
);
