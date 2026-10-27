import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import type { SupportCreateInput } from "@metastorage/contracts";
import {
  bookings,
  checkInSlots,
  db,
  eq,
  inArray,
  notificationOutbox,
  payments,
  queryClient,
  rentals,
  supportTickets,
  users,
} from "@metastorage/database";
import { SupportRepository } from "../../src/modules/support/support.repository";
import { supportRoutes } from "../../src/modules/support/support.routes";
import { createFacilityOperationsFixture } from "../fixtures/facility-operations";

describe.skipIf(!process.env.MY_STORAGE_LOCAL_DATABASE_URL)("Customer Support", () => {
  let fixture: Awaited<ReturnType<typeof createFacilityOperationsFixture>>;
  const bookingId = randomUUID();
  const otherBookingId = randomUUID();
  const slotId = randomUUID();
  const rentalId = randomUUID();
  const paymentId = randomUUID();
  const otherPaymentId = randomUUID();

  const input = (extra: Partial<SupportCreateInput> = {}): SupportCreateInput => ({
    bookingId,
    category: "PAYMENT",
    paymentId,
    subject: "Payment not recorded",
    content: "Please check my transaction.",
    idempotencyKey: randomUUID(),
    ...extra,
  });

  beforeAll(async () => {
    fixture = await createFacilityOperationsFixture();
    await db.update(users).set({ role: "CUSTOMER" }).where(eq(users.id, fixture.ids.peerStaff));
    await fixture.app.register(supportRoutes, {
      prefix: "/api/support",
      repository: new SupportRepository(db),
    });
    await db.insert(checkInSlots).values({
      id: slotId,
      name: "Support fixture",
      startTime: "09:00",
      endTime: "10:00",
    });
    await db.insert(bookings).values([
      {
        id: bookingId,
        userId: fixture.ids.customer,
        facilityId: fixture.facilityId,
        unitTypeId: fixture.typeId,
        checkInSlotId: slotId,
        contactPhone: "0901234567",
        checkInDate: "2026-10-24",
        requestedMonths: 1,
        rentalEndAt: new Date("2026-11-24T00:00:00Z"),
        monthlyRateSnapshot: "1000000",
        rentalFeeAmount: "1000000",
        depositAmount: "1000000",
        totalAmount: "2000000",
        status: "CHECKED_IN",
      },
      {
        id: otherBookingId,
        userId: fixture.ids.peerStaff,
        facilityId: fixture.otherFacilityId,
        unitTypeId: fixture.foreignTypeId,
        checkInSlotId: slotId,
        contactPhone: "0901234567",
        checkInDate: "2026-10-24",
        requestedMonths: 1,
        rentalEndAt: new Date("2026-11-24T00:00:00Z"),
        monthlyRateSnapshot: "1000000",
        rentalFeeAmount: "1000000",
        depositAmount: "1000000",
        totalAmount: "2000000",
      },
    ]);
    await db.insert(payments).values([
      {
        id: paymentId,
        bookingId,
        holdTokenHash: "support-test",
        provider: "mock",
        providerPaymentId: paymentId,
        paymentCode: paymentId.replaceAll("-", "").slice(0, 32),
        idempotencyKey: paymentId,
        totalAmount: "2000000",
        currency: "VND",
        status: "FAILED",
      },
      {
        id: otherPaymentId,
        bookingId: otherBookingId,
        holdTokenHash: "support-test",
        provider: "mock",
        providerPaymentId: otherPaymentId,
        paymentCode: otherPaymentId.replaceAll("-", "").slice(0, 32),
        idempotencyKey: otherPaymentId,
        totalAmount: "2000000",
        currency: "VND",
        status: "FAILED",
      },
    ]);
    await db.insert(rentals).values({
      id: rentalId,
      bookingId,
      facilityId: fixture.facilityId,
      physicalUnitId: fixture.unitId,
      startAt: new Date("2026-10-24T00:00:00Z"),
      expectedEndAt: new Date("2026-11-24T00:00:00Z"),
      depositAmount: "1000000",
      status: "ACTIVE",
    });
    await fixture.login();
  });

  afterAll(async () => {
    try {
      if (!fixture) return;
      const ids = (
        await db
          .select({ id: supportTickets.id })
          .from(supportTickets)
          .where(inArray(supportTickets.bookingId, [bookingId, otherBookingId]))
      ).map((row) => row.id);
      if (ids.length) {
        await db.delete(notificationOutbox).where(inArray(notificationOutbox.supportTicketId, ids));
        await db.delete(supportTickets).where(inArray(supportTickets.id, ids));
      }
      await db.delete(payments).where(inArray(payments.id, [paymentId, otherPaymentId]));
      await db.delete(rentals).where(eq(rentals.id, rentalId));
      await db.delete(bookings).where(inArray(bookings.id, [bookingId, otherBookingId]));
      await db.delete(checkInSlots).where(eq(checkInSlots.id, slotId));
      await fixture.cleanup();
    } finally {
      await queryClient.end();
    }
  });

  test("lists only owned contexts and payment attempts", async () => {
    const contexts = await fixture.api("customer", "GET", "/support/contexts?category=PAYMENT");
    expect(contexts.statusCode, contexts.body).toBe(200);
    expect(contexts.json().data.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: bookingId })]),
    );
    expect(contexts.body).not.toContain(otherBookingId);

    const attempts = await fixture.api(
      "customer",
      "GET",
      `/support/contexts/${bookingId}/payments`,
    );
    expect(attempts.statusCode, attempts.body).toBe(200);
    expect(attempts.json().data.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: paymentId, status: "FAILED" })]),
    );
    expect(
      (await fixture.api("customer", "GET", `/support/contexts/${otherBookingId}/payments`))
        .statusCode,
    ).toBe(404);
  });

  test("creates one immutable ticket and receipt; safe retries do not duplicate either", async () => {
    const payload = input();
    const [first, retry] = await Promise.all([
      fixture.api("customer", "POST", "/support/tickets", payload),
      fixture.api("customer", "POST", "/support/tickets", payload),
    ]);
    expect(first.statusCode, first.body).toBe(201);
    expect(retry.statusCode, retry.body).toBe(201);
    const detail = first.json().data;
    expect(retry.json().data.ticket.id).toBe(detail.ticket.id);
    expect(detail.ticket).toMatchObject({
      bookingId,
      paymentId,
      subject: payload.subject,
      description: payload.content,
      status: "OPEN",
    });
    expect(detail.messages).toEqual({ items: [], nextCursor: null });
    expect(
      await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.idempotencyKey, payload.idempotencyKey)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.supportTicketId, detail.ticket.id)),
    ).toHaveLength(1);

    const conflict = await fixture.api("customer", "POST", "/support/tickets", {
      ...payload,
      content: "Changed request",
    });
    expect(conflict.statusCode).toBe(409);
  });

  test("requires handover for warehouse requests and rejects another booking's payment", async () => {
    const warehouse = await fixture.api(
      "customer",
      "POST",
      "/support/tickets",
      input({ category: "UNIT", paymentId: undefined }),
    );
    expect(warehouse.statusCode, warehouse.body).toBe(201);
    expect(warehouse.json().data.ticket).toMatchObject({ rentalId, paymentId: null });

    const forged = await fixture.api(
      "customer",
      "POST",
      "/support/tickets",
      input({ paymentId: otherPaymentId }),
    );
    expect(forged.statusCode).toBe(400);
  });

  test("keeps tickets private and has no reply or attachment routes", async () => {
    const response = await fixture.api("customer", "POST", "/support/tickets", input());
    const id = response.json().data.ticket.id;
    expect((await fixture.api("peerStaff", "GET", `/support/tickets/${id}`)).statusCode).toBe(404);
    expect((await fixture.api("manager", "GET", "/support/tickets")).statusCode).toBe(403);
    expect(
      (await fixture.api("customer", "POST", `/support/tickets/${id}/messages`, {})).statusCode,
    ).toBe(404);
    expect(
      (await fixture.api("customer", "POST", `/support/tickets/${id}/attachments`, {})).statusCode,
    ).toBe(404);
  });
});
