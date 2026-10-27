import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  and,
  bookings,
  checkInSlots,
  db,
  eq,
  inArray,
  notificationOutbox,
  payments,
  rentals,
  supportAudit,
  supportIdempotency,
  supportMessages,
  supportTickets,
  users,
} from "@metastorage/database";
import {
  facilityWorkspaceRoutes,
  supportWithdrawalRoutes,
} from "../../src/modules/facility-workspace/facility-workspace.routes";
import { supportRoutes } from "../../src/modules/support/support.routes";
import { createFacilityOperationsFixture } from "../fixtures/facility-operations";

describe.skipIf(!process.env.MY_STORAGE_LOCAL_DATABASE_URL)("FM facility workspace", () => {
  let f: Awaited<ReturnType<typeof createFacilityOperationsFixture>>;
  const bookingId = randomUUID(),
    rentalId = randomUUID(),
    slotId = randomUUID(),
    paymentId = randomUUID();
  const path = (id: string) => `/facility-workspace/support/${id}`;
  async function create(category = "UNIT") {
    const response = await f.api("customer", "POST", "/support/tickets", {
      bookingId,
      category,
      subject: "Facility workspace issue",
      content: "Please check this unit condition.",
      idempotencyKey: randomUUID(),
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json().data.ticket;
  }
  async function action(
    who: "manager" | "staff" | "peerStaff" | "otherManager" | "bom",
    ticket: { id: string; version: number },
    input: Record<string, unknown>,
  ) {
    return f.api(who, "POST", `${path(ticket.id)}/actions`, { version: ticket.version, ...input });
  }
  beforeAll(async () => {
    f = await createFacilityOperationsFixture();
    await db.update(users).set({ name: "Khách đang thuê" }).where(eq(users.id, f.ids.customer));
    await f.app.register(supportRoutes, { prefix: "/api/support" });
    await f.app.register(supportWithdrawalRoutes, { prefix: "/api/support" });
    await f.app.register(facilityWorkspaceRoutes, { prefix: "/api/facility-workspace" });
    await db
      .insert(checkInSlots)
      .values({ id: slotId, name: "FM workspace", startTime: "09:00", endTime: "10:00" });
    await db.insert(bookings).values({
      id: bookingId,
      bookingCode: `FM-${bookingId.slice(0, 8)}`,
      contactPhone: "0901234567",
      userId: f.ids.customer,
      facilityId: f.facilityId,
      unitTypeId: f.typeId,
      requestedMonths: 1,
      checkInDate: "2026-10-27",
      checkInSlotId: slotId,
      rentalEndAt: new Date("2026-11-27T00:00:00Z"),
      monthlyRateSnapshot: "1000000",
      rentalFeeAmount: "1000000",
      depositAmount: "1000000",
      totalAmount: "2000000",
      status: "CHECKED_IN",
    });
    await db.insert(rentals).values({
      id: rentalId,
      bookingId,
      facilityId: f.facilityId,
      physicalUnitId: f.unitId,
      status: "ACTIVE",
      startAt: new Date("2026-10-27"),
      expectedEndAt: new Date("2026-11-27"),
      depositAmount: "1000000",
    });
    await db.insert(payments).values({
      id: paymentId,
      bookingId,
      holdTokenHash: "workspace-test",
      provider: "mock",
      paymentCode: paymentId.slice(0, 32),
      providerPaymentId: paymentId,
      idempotencyKey: paymentId,
      totalAmount: "2000000",
      currency: "VND",
      status: "SUCCEEDED",
      paidAt: new Date(),
    });
    await f.login();
  });
  afterAll(async () => {
    if (!f) return;
    const tickets = await db
      .select({ id: supportTickets.id })
      .from(supportTickets)
      .where(eq(supportTickets.bookingId, bookingId));
    const ids = tickets.map((row) => row.id);
    if (ids.length) {
      await db.delete(notificationOutbox).where(inArray(notificationOutbox.supportTicketId, ids));
      await db.delete(supportIdempotency).where(inArray(supportIdempotency.ticketId, ids));
      await db.delete(supportAudit).where(inArray(supportAudit.ticketId, ids));
      await db.delete(supportMessages).where(inArray(supportMessages.ticketId, ids));
      await db.delete(supportTickets).where(inArray(supportTickets.id, ids));
    }
    await db.delete(payments).where(eq(payments.id, paymentId));
    await db.delete(rentals).where(eq(rentals.id, rentalId));
    await db.delete(bookings).where(eq(bookings.id, bookingId));
    await db.delete(checkInSlots).where(eq(checkInSlots.id, slotId));
    await f.cleanup();
  });
  test("rental customers and payment history are restricted to the assigned FM", async () => {
    const list = await f.api(
      "manager",
      "GET",
      `/facility-workspace/rentals?facilityId=${f.facilityId}`,
    );
    expect(list.statusCode, list.body).toBe(200);
    expect(list.json().data.items[0]).toMatchObject({
      id: rentalId,
      customerName: "Khách đang thuê",
      status: "ACTIVE",
    });
    const detail = await f.api("manager", "GET", `/facility-workspace/rentals/${rentalId}`);
    expect(detail.json().data.payments[0]).toMatchObject({ id: paymentId, status: "SUCCEEDED" });
    expect(
      (await f.api("otherManager", "GET", `/facility-workspace/rentals/${rentalId}`)).statusCode,
    ).toBe(404);
    expect(
      (await f.api("otherManager", "GET", `/facility-workspace/rentals?facilityId=${f.facilityId}`))
        .statusCode,
    ).toBe(403);
    expect(
      (await f.api("staff", "GET", `/facility-workspace/rentals?facilityId=${f.facilityId}`))
        .statusCode,
    ).toBe(403);
  });
  test("queue access and assignment require active, same-facility memberships", async () => {
    const ticket = await create();
    expect((await f.api("otherManager", "GET", `${path(ticket.id)}`)).statusCode).toBe(404);
    expect((await f.api("staff", "GET", path(ticket.id))).statusCode).toBe(404);
    for (const staffId of [f.ids.otherStaff, f.ids.inactiveStaff, f.ids.expiredStaff])
      expect(
        (await action("manager", ticket, { action: "ASSIGN", staffId, reason: "Assign staff" }))
          .statusCode,
      ).toBe(422);
    const assigned = await action("manager", ticket, {
      action: "ASSIGN",
      staffId: f.ids.staff,
      reason: "Check the unit",
    });
    expect(assigned.statusCode, assigned.body).toBe(200);
    expect(assigned.json().data.ticket).toMatchObject({
      status: "IN_PROGRESS",
      assignedStaffId: f.ids.staff,
      version: 1,
    });
    expect((await f.api("staff", "GET", path(ticket.id))).statusCode).toBe(200);
    const reassigned = await action("manager", assigned.json().data.ticket, {
      action: "ASSIGN",
      staffId: f.ids.peerStaff,
      reason: "Change staff shift",
    });
    expect(reassigned.statusCode, reassigned.body).toBe(200);
    expect((await f.api("staff", "GET", path(ticket.id))).statusCode).toBe(404);
    expect((await f.api("peerStaff", "GET", path(ticket.id))).statusCode).toBe(200);
  });
  test("internal notes stay out of customer, staff and email payloads", async () => {
    const ticket = await create();
    const assigned = (
      await action("manager", ticket, {
        action: "ASSIGN",
        staffId: f.ids.staff,
        reason: "Check the unit",
      })
    ).json().data.ticket;
    const result = await action("manager", assigned, {
      action: "NOTE",
      content: "PRIVATE-MANAGER-ONLY",
    });
    expect(result.statusCode, result.body).toBe(200);
    expect(JSON.stringify((await f.api("staff", "GET", path(ticket.id))).json())).not.toContain(
      "PRIVATE-MANAGER-ONLY",
    );
    expect(
      JSON.stringify((await f.api("customer", "GET", `/support/tickets/${ticket.id}`)).json()),
    ).not.toContain("PRIVATE-MANAGER-ONLY");
    expect(
      (await action("staff", result.json().data.ticket, { action: "NOTE", content: "Not allowed" }))
        .statusCode,
    ).toBe(403);
    const mail = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.supportTicketId, ticket.id));
    expect(mail.every((row) => !row.body.includes("PRIVATE-MANAGER-ONLY"))).toBe(true);
    expect(mail.filter((row) => row.recipientRole === "FACILITY_MANAGER").length).toBeGreaterThan(
      0,
    );
    expect(
      mail.filter((row) => row.recipientRole === "CUSTOMER" && row.status === "PENDING"),
    ).toHaveLength(1);
  });
  test("FS reports require FM acceptance of the current assignment's latest report", async () => {
    const ticket = await create();
    let current = (
      await action("manager", ticket, {
        action: "ASSIGN",
        staffId: f.ids.staff,
        reason: "Check the unit",
      })
    ).json().data.ticket;
    current = (await action("staff", current, { action: "START" })).json().data.ticket;
    let result = await action("staff", current, {
      action: "REPORT",
      content: "The door has been repaired.",
    });
    expect(result.statusCode, result.body).toBe(200);
    current = result.json().data.ticket;
    expect(current.status).toBe("IN_PROGRESS");
    const oldReport = current.latestReportId;
    result = await action("staff", current, {
      action: "REPORT",
      content: "Final inspection completed.",
    });
    current = result.json().data.ticket;
    expect(
      (
        await action("manager", current, {
          action: "ACCEPT",
          reportId: oldReport,
          reason: "Review old report",
        })
      ).statusCode,
    ).toBe(409);
    result = await action("manager", current, {
      action: "ACCEPT",
      reportId: current.latestReportId,
      reason: "Confirmed that the unit is usable.",
    });
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json().data.ticket.status).toBe("CLOSED");
    expect(
      (
        await action("staff", result.json().data.ticket, {
          action: "REPORT",
          content: "Must not proceed",
        })
      ).statusCode,
    ).toBe(409);
    const reopen = await action("manager", result.json().data.ticket, {
      action: "REOPEN",
      reason: "Customer needs more assistance",
    });
    expect(reopen.json().data.ticket).toMatchObject({
      status: "OPEN",
      assignedStaffId: null,
      latestReportId: null,
    });
    expect((await db.select().from(rentals).where(eq(rentals.id, rentalId)))[0]?.status).toBe(
      "ACTIVE",
    );
  });
  test("stale and concurrent mutations do not overwrite state or duplicate audit", async () => {
    const ticket = await create();
    const results = await Promise.all([
      action("manager", ticket, {
        action: "PRIORITY",
        priority: "HIGH",
        reason: "Urgent storage issue",
      }),
      action("manager", ticket, { action: "REPLY", content: "We will investigate today." }),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const audit = await db
      .select()
      .from(supportAudit)
      .where(and(eq(supportAudit.ticketId, ticket.id), eq(supportAudit.nextVersion, 1)));
    expect(audit).toHaveLength(1);
  });
  test("customer withdrawal stops staff without accepting their report", async () => {
    const ticket = await create();
    const assigned = (
      await action("manager", ticket, {
        action: "ASSIGN",
        staffId: f.ids.staff,
        reason: "Check the unit",
      })
    ).json().data.ticket;
    const closed = await f.api("customer", "POST", `/support/tickets/${ticket.id}/close`, {
      version: assigned.version,
      reason: "I no longer need help",
    });
    expect(closed.statusCode, closed.body).toBe(200);
    expect(closed.json().data.closureKind).toBe("CUSTOMER_WITHDREW");
    expect(
      (
        await action("staff", closed.json().data, {
          action: "REPORT",
          content: "Must not continue",
        })
      ).statusCode,
    ).toBe(409);
    expect(
      await db
        .select()
        .from(supportAudit)
        .where(and(eq(supportAudit.ticketId, ticket.id), eq(supportAudit.action, "ACCEPT"))),
    ).toHaveLength(0);
  });
  test("PAYMENT stays under BOM control while FM can assign local help", async () => {
    const ticket = await create("PAYMENT");
    const assigned = (
      await action("manager", ticket, {
        action: "ASSIGN",
        staffId: f.ids.staff,
        reason: "Collect on-site transaction information",
      })
    ).json().data.ticket;
    expect(
      (await action("manager", assigned, { action: "CLOSE", reason: "Must not decide payment" }))
        .statusCode,
    ).toBe(403);
    const started = await action("bom", assigned, { action: "START" });
    expect(started.statusCode, started.body).toBe(200);
    const closed = await action("bom", started.json().data.ticket, {
      action: "CLOSE",
      reason: "Payment issue handled by business operations.",
    });
    expect(closed.statusCode, closed.body).toBe(200);
    expect(closed.json().data.ticket.status).toBe("CLOSED");
  });
});
