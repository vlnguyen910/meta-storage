import { expect, test } from "bun:test";
import { notificationSocketHarness } from "../fixtures/notification-socket";

test.skipIf(process.env.RUN_INSPECTION_DB_TESTS !== "1")(
  "FM sockets observe committed appointments/tasks, isolate facilities and recheck access",
  async () => {
    const { assertIsolatedDatabase, createInspectionFixture } = await import(
      "../fixtures/inspection-fixture"
    );
    assertIsolatedDatabase();
    const { buildApp } = await import("../../src/app");
    const { db, appointments, checkInSlots, reservations, facilityAssignments, sessions, and, eq } =
      await import("@metastorage/database");
    const f = await createInspectionFixture();
    const other = await createInspectionFixture();
    const app = buildApp();
    const origin = process.env.AUTH_TRUSTED_ORIGINS?.split(",")[0] ?? "http://localhost:3000";
    await app.listen({ host: "127.0.0.1", port: 0 });
    const { login, connect, waitFor, sockets } = notificationSocketHarness(app, origin, f.password);
    try {
      const manager = await login(f.managerEmail);
      const customer = await login(f.customerEmail);
      const staff = await login(f.email);
      const outsider = await login(other.managerEmail);
      const received: unknown[] = [],
        secondTab: unknown[] = [],
        foreign: unknown[] = [],
        staffEvents: unknown[] = [];
      const first = await connect(manager, received);
      await connect(manager, secondTab);
      await connect(outsider, foreign);
      const staffSocket = await connect(staff, staffEvents);
      staffSocket.onmessage = (event) => {
        const value = JSON.parse(String(event.data));
        if (value.type === "STAFF_TASK_ASSIGNED") staffEvents.push(value);
      };
      await connect(customer, []);
      const [initial] = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, f.bookingId));
      if (!initial) throw new Error("Missing appointment fixture");
      // Use a future slot inside the real operating hours, with a matching reservation start.
      await db
        .update(checkInSlots)
        .set({ startTime: "09:00:00", endTime: "10:00:00" })
        .where(eq(checkInSlots.id, initial.slotId));
      await db
        .update(reservations)
        .set({ rentalStartAt: new Date(`${initial.scheduledDate}T09:00:00+07:00`) })
        .where(eq(reservations.id, f.bookingId));
      const create = () =>
        app.inject({
          method: "POST",
          url: "/api/appointments/",
          headers: { origin, cookie: customer },
          payload: {
            appointmentType: "CHECK_IN",
            reservationId: f.bookingId,
            scheduledDate: initial.scheduledDate,
            slotId: initial.slotId,
          },
        });
      // A duplicate appointment fails before commit and must emit nothing.
      expect((await create()).statusCode).toBe(409);
      await Bun.sleep(80);
      expect(received).toHaveLength(0);
      const cancelled = await app.inject({
        method: "PATCH",
        url: `/api/appointments/${f.bookingId}`,
        headers: { origin, cookie: customer },
        payload: { status: "CANCELLED" },
      });
      expect(cancelled.statusCode).toBe(200);
      await waitFor(() => received.length === 1 && secondTab.length === 1);
      expect(received[0]).toMatchObject({
        type: "FACILITY_WORK_UPDATED",
        facilityId: f.facilityId,
      });
      const created = await create();
      expect(created.statusCode).toBe(201);
      await waitFor(() => received.length === 2 && secondTab.length === 2);
      const appointmentId = created.json().data.id as string;
      expect(
        (await db.select().from(appointments).where(eq(appointments.id, appointmentId)))[0]?.status,
      ).toBe("SCHEDULED");
      const assigned = await app.inject({
        method: "PATCH",
        url: `/api/appointments/${appointmentId}`,
        headers: { origin, cookie: manager },
        payload: { assignedStaffId: f.userId, status: "CONFIRMED" },
      });
      expect(assigned.statusCode).toBe(200);
      await waitFor(
        () => received.length === 3 && secondTab.length === 3 && staffEvents.length === 1,
      );
      const task = await app.inject({
        method: "POST",
        url: "/api/facility-tasks/",
        headers: { origin, cookie: manager },
        payload: {
          facilityId: f.facilityId,
          assignedStaffId: f.userId,
          type: "UNIT_INSPECTION",
          referenceType: "STORAGE_UNIT",
          referenceId: f.unitId,
        },
      });
      expect(task.statusCode).toBe(201);
      const taskId = task.json().data.id as string;
      await waitFor(() => received.length === 4 && secondTab.length === 4);
      for (const [index, status] of ["IN_PROGRESS", "COMPLETED"].entries()) {
        const response = await app.inject({
          method: "PATCH",
          url: `/api/facility-tasks/${taskId}`,
          headers: { origin, cookie: staff },
          payload: { status },
        });
        expect(response.statusCode).toBe(200);
        await waitFor(() => received.length === 5 + index && secondTab.length === 5 + index);
        const detail = await app.inject({
          method: "GET",
          url: "/api/facility-tasks/facility",
          headers: { cookie: manager },
        });
        expect(detail.statusCode).toBe(200);
        expect(
          detail.json().data.items.find((item: { id: string }) => item.id === taskId)?.status,
        ).toBe(status);
      }
      // Cancelling the parent reservation also closes its appointment and assigned task.
      const cancelledReservation = await app.inject({
        method: "PATCH",
        url: `/api/reservations/${f.bookingId}`,
        headers: { origin, cookie: customer },
        payload: { status: "CANCELLED" },
      });
      expect(cancelledReservation.statusCode).toBe(200);
      // Both the original cancelled appointment and the replacement are refreshed.
      await waitFor(() => received.length === 8 && secondTab.length === 8);
      expect(
        (await db.select().from(appointments).where(eq(appointments.id, appointmentId)))[0]?.status,
      ).toBe("CANCELLED");
      expect(foreign).toHaveLength(0);
      expect(staffEvents).toHaveLength(1); // FM update events never go to the existing Staff channel.
      // Reconnect has no replay; the frontend performs an authoritative refetch on open.
      first.close();
      await waitFor(() => first.readyState === WebSocket.CLOSED);
      const replay: unknown[] = [];
      const reconnected = await connect(manager, replay);
      await Bun.sleep(80);
      expect(replay).toHaveLength(0);
      await db
        .update(facilityAssignments)
        .set({ isActive: false })
        .where(
          and(
            eq(facilityAssignments.facilityId, f.facilityId),
            eq(facilityAssignments.userId, f.managerId),
          ),
        );
      await app.notifications.managerWorkChanged(f.facilityId);
      await Bun.sleep(80);
      expect(replay).toHaveLength(0);
      expect(secondTab).toHaveLength(8);
      await db
        .update(sessions)
        .set({ expiresAt: new Date(0) })
        .where(eq(sessions.userId, f.managerId));
      await app.notifications.managerWorkChanged(f.facilityId);
      await waitFor(() => reconnected.readyState === WebSocket.CLOSED);
      expect(replay).toHaveLength(0);
    } finally {
      for (const socket of sockets) socket.close();
      app.server.closeAllConnections();
      try {
        await other.cleanup();
        await f.cleanup();
      } finally {
        await app.close();
      }
    }
  },
  30_000,
);
