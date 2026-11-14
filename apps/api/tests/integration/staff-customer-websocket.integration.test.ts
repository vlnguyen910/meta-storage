import { expect, test } from "bun:test";

test.skipIf(process.env.RUN_INSPECTION_DB_TESTS !== "1")(
  "FS/customer sockets isolate owners, remove reassigned work and never expose internal task progress to customers",
  async () => {
    const { assertIsolatedDatabase, createInspectionFixture } = await import(
      "../fixtures/inspection-fixture"
    );
    assertIsolatedDatabase();
    const { buildApp } = await import("../../src/app");
    const { env } = await import("../../src/config/env");
    const { db, sessions, eq } = await import("@metastorage/database");
    const f = await createInspectionFixture();
    const other = await createInspectionFixture();
    const app = buildApp();
    const sockets: WebSocket[] = [];
    const origin = env.AUTH_TRUSTED_ORIGINS.split(",")[0] ?? "http://localhost:3000";
    const previousOrigins = env.AUTH_TRUSTED_ORIGINS;
    env.AUTH_TRUSTED_ORIGINS += ",metastorage://";
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("No server port");
    const url = `ws://127.0.0.1:${address.port}/api/notifications/ws`;
    type Event = { type: string; recipientId?: string; appointmentId?: string; taskId?: string };
    async function login(email: string) {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: { origin },
        payload: { email, password: f.password },
      });
      expect(response.statusCode).toBe(200);
      const cookies = response.headers["set-cookie"];
      return (Array.isArray(cookies) ? cookies : [cookies ?? ""])
        .map((cookie) => cookie.split(";")[0])
        .join("; ");
    }
    async function connect(cookie: string, messages: Event[], source = origin) {
      const socket = new WebSocket(url, { headers: { cookie, origin: source } });
      sockets.push(socket);
      socket.onmessage = (event) => messages.push(JSON.parse(String(event.data)));
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
    async function waitFor(predicate: () => boolean) {
      const end = Date.now() + 3000;
      while (!predicate() && Date.now() < end) await Bun.sleep(10);
      expect(predicate()).toBe(true);
    }
    const work = (events: Event[]) => events.filter((event) => event.type === "STAFF_WORK_UPDATED");
    try {
      const manager = await login(f.managerEmail),
        firstCookie = await login(f.email),
        secondCookie = await login(f.outsiderEmail);
      const customerCookie = await login(f.customerEmail),
        foreignCustomer = await login(other.customerEmail),
        foreignStaff = await login(other.email);
      const customer: Event[] = [],
        nativeCustomer: Event[] = [],
        first: Event[] = [],
        second: Event[] = [],
        forbidden: Event[] = [];
      const customerSocket = await connect(customerCookie, customer);
      await connect(customerCookie, nativeCustomer, "metastorage://"); // Native cookie + explicit Origin, no token in URL.
      await connect(firstCookie, first);
      await connect(secondCookie, second);
      await connect(foreignCustomer, forbidden);
      await connect(foreignStaff, forbidden);
      await expect(connect("", [])).rejects.toThrow();
      await expect(connect(customerCookie, [], "https://untrusted.example")).rejects.toThrow();
      const assign = (staffId: string) =>
        app.inject({
          method: "PATCH",
          url: `/api/appointments/${f.bookingId}`,
          headers: { cookie: manager, origin },
          payload: { status: "CONFIRMED", assignedStaffId: staffId },
        });
      expect((await assign(f.userId)).statusCode).toBe(200);
      await waitFor(
        () => customer.length === 1 && nativeCustomer.length === 1 && work(first).length === 1,
      );
      expect(customer[0]).toMatchObject({
        type: "CUSTOMER_APPOINTMENT_UPDATED",
        recipientId: f.customerId,
        appointmentId: f.bookingId,
      });
      expect(work(second)).toHaveLength(0);
      expect((await assign(f.outsiderId)).statusCode).toBe(200);
      await waitFor(
        () => customer.length === 2 && work(first).length === 2 && work(second).length === 1,
      );
      const oldList = await app.inject({
        method: "GET",
        url: "/api/appointments/assigned-to-me",
        headers: { cookie: firstCookie },
      });
      expect(oldList.statusCode).toBe(200);
      expect(oldList.json().data.some((item: { id: string }) => item.id === f.bookingId)).toBe(
        false,
      );
      const oldDetail = await app.inject({
        method: "GET",
        url: `/api/appointments/${f.bookingId}`,
        headers: { cookie: firstCookie },
      });
      expect(oldDetail.statusCode).toBe(403);
      const cancel = await app.inject({
        method: "PATCH",
        url: `/api/appointments/${f.bookingId}`,
        headers: { cookie: customerCookie, origin },
        payload: { status: "CANCELLED" },
      });
      expect(cancel.statusCode).toBe(200);
      await waitFor(
        () => customer.length === 3 && work(second).length === 2 && nativeCustomer.length === 3,
      );
      const task = await app.inject({
        method: "POST",
        url: "/api/facility-tasks/",
        headers: { cookie: manager, origin },
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
      await waitFor(() => work(first).length === 3);
      expect(work(first).at(-1)).toMatchObject({ taskId, recipientId: f.userId });
      const reassign = await app.inject({
        method: "PATCH",
        url: `/api/facility-tasks/${taskId}`,
        headers: { cookie: manager, origin },
        payload: { assignedStaffId: f.outsiderId },
      });
      expect(reassign.statusCode).toBe(200);
      await waitFor(() => work(first).length === 4 && work(second).length === 3);
      for (const [index, status] of ["IN_PROGRESS", "COMPLETED"].entries()) {
        const response = await app.inject({
          method: "PATCH",
          url: `/api/facility-tasks/${taskId}`,
          headers: { cookie: secondCookie, origin },
          payload: { status },
        });
        expect(response.statusCode).toBe(200);
        await waitFor(() => work(second).length === 4 + index);
      }
      expect(customer).toHaveLength(3);
      expect(nativeCustomer).toHaveLength(3);
      expect(forbidden).toHaveLength(0);
      const beforeFailure = work(second).length;
      const failed = await app.inject({
        method: "PATCH",
        url: `/api/facility-tasks/${taskId}`,
        headers: { cookie: secondCookie, origin },
        payload: { status: "IN_PROGRESS" },
      });
      expect(failed.statusCode).toBe(409);
      await Bun.sleep(80);
      expect(work(second)).toHaveLength(beforeFailure);
      await db
        .update(sessions)
        .set({ expiresAt: new Date(0) })
        .where(eq(sessions.userId, f.customerId));
      await app.notifications.appointmentChanged(f.bookingId);
      await waitFor(() => customerSocket.readyState === WebSocket.CLOSED);
      expect(customer).toHaveLength(3);
      expect(nativeCustomer).toHaveLength(3);
    } finally {
      env.AUTH_TRUSTED_ORIGINS = previousOrigins;
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
