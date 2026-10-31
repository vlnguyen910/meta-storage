import { expect, spyOn, test } from "bun:test";

test.skipIf(process.env.RUN_INSPECTION_DB_TESTS !== "1")(
  "real WebSockets isolate Staff, notify after assignment, reconnect without replay and reject revoked sessions",
  async () => {
    const { assertIsolatedDatabase, createInspectionFixture } = await import(
      "../fixtures/inspection-fixture"
    );
    assertIsolatedDatabase();
    const { buildApp } = await import("../../src/app");
    const { db, appointments, sessions, users, eq } = await import("@metastorage/database");
    const f = await createInspectionFixture();
    const app = buildApp();
    const sockets: WebSocket[] = [];
    const origin = process.env.AUTH_TRUSTED_ORIGINS?.split(",")[0] ?? "http://localhost:3000";
    await app.listen({ host: "127.0.0.1", port: 0 });
    const mail = spyOn(app.mailQueue, "add");
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("No server port");
    const url = `ws://127.0.0.1:${address.port}/api/notifications/ws`;
    async function login(email: string) {
      const result = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: { origin },
        payload: { email, password: f.password },
      });
      expect(result.statusCode).toBe(200);
      const cookies = result.headers["set-cookie"];
      return (Array.isArray(cookies) ? cookies : [cookies ?? ""])
        .map((c) => c.split(";")[0])
        .join("; ");
    }
    // Bun's native WebSocket client accepts headers; use a real TCP upgrade, not injectWS.
    async function connect(cookie: string, source = origin) {
      const socket = new WebSocket(url, { headers: { cookie, origin: source } });
      sockets.push(socket);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("WebSocket upgrade timed out")), 3000);
        socket.onopen = () => {
          clearTimeout(timer);
          resolve();
        };
        socket.onerror = () => {
          clearTimeout(timer);
          reject(new Error("WebSocket upgrade rejected"));
        };
      });
      return socket;
    }
    const waitFor = async (predicate: () => boolean) => {
      const end = Date.now() + 3000;
      while (!predicate() && Date.now() < end)
        await new Promise((resolve) => setTimeout(resolve, 10));
      expect(predicate()).toBe(true);
    };
    try {
      const manager = await login(f.managerEmail),
        staff = await login(f.email),
        other = await login(f.outsiderEmail);
      await expect(connect("")).rejects.toThrow();
      await expect(connect(manager)).rejects.toThrow();
      await expect(connect(staff, "https://untrusted.example")).rejects.toThrow();
      const first = await connect(staff),
        second = await connect(staff),
        outsider = await connect(other);
      const received: Record<string, unknown>[] = [],
        another: unknown[] = [],
        forbidden: unknown[] = [];
      first.onmessage = (e) => received.push(JSON.parse(String(e.data)));
      second.onmessage = (e) => another.push(JSON.parse(String(e.data)));
      outsider.onmessage = (e) => forbidden.push(e.data);
      const assign = (staffId: string) =>
        app.inject({
          method: "PATCH",
          url: `/api/appointments/${f.bookingId}`,
          headers: { cookie: manager, origin },
          payload: { assignedStaffId: staffId, status: "CONFIRMED" },
        });

      expect((await assign(f.userId)).statusCode).toBe(200);
      await waitFor(() => received.length === 1 && another.length === 1);
      expect(received[0]).toMatchObject({
        type: "STAFF_TASK_ASSIGNED",
        recipientId: f.userId,
        appointmentId: f.bookingId,
      });
      expect(received[0]?.id).toEqual(expect.any(String));
      expect(forbidden).toHaveLength(0);
      expect(
        (await db.select().from(appointments).where(eq(appointments.id, f.bookingId)))[0]
          ?.assignedStaffId,
      ).toBe(f.userId);
      expect((await assign(f.userId)).statusCode).toBe(200);
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(received).toHaveLength(1); // Same-assignment retry does not duplicate notifications.
      await db.update(users).set({ status: "INACTIVE" }).where(eq(users.id, f.outsiderId));
      expect((await assign(f.outsiderId)).statusCode).toBe(403);
      expect(forbidden).toHaveLength(0);
      await db.update(users).set({ status: "ACTIVE" }).where(eq(users.id, f.outsiderId));
      first.close();
      second.close();
      await waitFor(
        () => first.readyState === WebSocket.CLOSED && second.readyState === WebSocket.CLOSED,
      );
      expect((await assign(f.outsiderId)).statusCode).toBe(200);
      await waitFor(() => forbidden.length === 1);
      const reconnected = await connect(staff);
      const replay: unknown[] = [];
      reconnected.onmessage = (e) => replay.push(e.data);
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(replay).toHaveLength(0);
      expect((await assign(f.userId)).statusCode).toBe(200);
      await waitFor(() => replay.length === 1);
      // Expiry also prevents sending through a previously authenticated socket.
      await db
        .update(sessions)
        .set({ expiresAt: new Date(0) })
        .where(eq(sessions.userId, f.userId));
      const closed = new Promise<void>((resolve) => {
        reconnected.onclose = () => resolve();
      });
      expect((await assign(f.outsiderId)).statusCode).toBe(200);
      expect((await assign(f.userId)).statusCode).toBe(200);
      await Promise.race([
        closed,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Revoked socket stayed open")), 3000),
        ),
      ]);
      expect(replay).toHaveLength(1);
      expect(forbidden).toHaveLength(2);
      const failedDelivery = spyOn(app.notifications, "assignedAppointment").mockRejectedValueOnce(
        new Error("Delivery unavailable"),
      );
      const log = spyOn(console, "error").mockImplementation(() => {});
      try {
        expect((await assign(f.outsiderId)).statusCode).toBe(200);
        expect(
          (await db.select().from(appointments).where(eq(appointments.id, f.bookingId)))[0]
            ?.assignedStaffId,
        ).toBe(f.outsiderId);
        expect(log).toHaveBeenCalled();
      } finally {
        failedDelivery.mockRestore();
        log.mockRestore();
      }
      expect(mail).not.toHaveBeenCalled();
    } finally {
      mail.mockRestore();
      for (const socket of sockets) socket.close();
      // Bun 1.3 retains rejected upgrade connections after native clients close.
      app.server.closeAllConnections();
      try {
        await f.cleanup();
      } finally {
        await app.close();
      }
    }
  },
  30_000,
);
