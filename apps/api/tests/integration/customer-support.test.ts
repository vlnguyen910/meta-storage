import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import type { SupportCreateInput, SupportDetail, SupportImageInput } from "@metastorage/contracts";
import {
  and,
  bookings,
  checkInSlots,
  db,
  eq,
  inArray,
  notificationOutbox,
  payments,
  queryClient,
  rentals,
  storageUnits,
  supportAttachments,
  supportAudit,
  supportIdempotency,
  supportMessages,
  supportTickets,
  users,
} from "@metastorage/database";
import { createHttpClient, createMetastorageApiClient } from "../../../../packages/api-client/src";
import { OutboxRepository } from "../../../worker/src/notifications/outbox.repository";
import { OutboxService } from "../../../worker/src/notifications/outbox.service";
import { swaggerPlugin } from "../../src/common/plugins/swagger";
import { SupportRepository } from "../../src/modules/support/support.repository";
import { supportRoutes } from "../../src/modules/support/support.routes";
import type { SupportImageStorage } from "../../src/modules/support/support.types";
import { createFacilityOperationsFixture } from "../fixtures/facility-operations";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jPrsAAAAASUVORK5CYII=",
  "base64",
);
const jpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==",
  "base64",
);
const webp = Buffer.from("UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=", "base64");
class TestStorage implements SupportImageStorage {
  objects = new Map<string, Buffer>();
  puts = 0;
  removes: string[] = [];
  failPut = false;
  afterGet?: () => Promise<void>;
  async put(key: string, bytes: Uint8Array) {
    this.puts++;
    if (this.failPut) throw new Error("Injected storage failure");
    this.objects.set(key, Buffer.from(bytes));
  }
  async get(key: string) {
    const bytes = this.objects.get(key);
    if (!bytes) throw new Error("Missing test image");
    await this.afterGet?.();
    return bytes;
  }
  async remove(key: string) {
    this.removes.push(key);
    this.objects.delete(key);
  }
}

describe.skipIf(!process.env.MY_STORAGE_LOCAL_DATABASE_URL)("Customer Support", () => {
  let f: Awaited<ReturnType<typeof createFacilityOperationsFixture>>;
  const bookingId = randomUUID(),
    otherBookingId = randomUUID(),
    slotId = randomUUID();
  const rentalId = randomUUID(),
    paymentId = randomUUID(),
    otherPaymentId = randomUUID();
  const storage = new TestStorage();
  const repository = new SupportRepository(db);
  const input = (extra: Partial<SupportCreateInput> = {}): SupportCreateInput => ({
    bookingId,
    category: "PAYMENT",
    subject: "Payment not recorded",
    content: "Please check my transaction.",
    idempotencyKey: randomUUID(),
    ...extra,
  });
  async function create(extra: Partial<SupportCreateInput> = {}): Promise<SupportDetail> {
    const r = await f.api("customer", "POST", "/support/tickets", input(extra));
    expect(r.statusCode, r.body).toBe(201);
    return r.json().data;
  }
  test("discovers owned pre-handover payment contexts and isolates attempts", async () => {
    const response = await f.api("customer", "GET", "/support/contexts?category=PAYMENT&limit=1");
    expect(response.statusCode, response.body).toBe(200);
    const page = response.json().data;
    expect(page.items.some((item: { id: string }) => item.id === bookingId)).toBe(true);
    expect(response.body).not.toContain(otherBookingId);
    expect(response.body).not.toContain("holdTokenHash");
    const attempts = await f.api("customer", "GET", `/support/contexts/${bookingId}/payments`);
    expect(attempts.statusCode, attempts.body).toBe(200);
    expect(attempts.json().data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: paymentId, status: "FAILED", source: "BOOKING" }),
      ]),
    );
    const forbidden = await f.api(
      "customer",
      "GET",
      `/support/contexts/${otherBookingId}/payments`,
    );
    expect(forbidden.statusCode).toBe(404);
    const physical = await f.api("customer", "GET", "/support/contexts?category=UNIT");
    expect(physical.statusCode).toBe(200);
    expect(physical.json().data.items).toEqual([]);
  });

  const imageInput = (version: number): SupportImageInput => ({
    filename: "condition.png",
    mimeType: "image/png",
    dataBase64: png.toString("base64"),
    version,
    idempotencyKey: randomUUID(),
  });
  const uploadPath = (t: SupportDetail) =>
    `/support/tickets/${t.ticket.id}/messages/${t.messages.items[0]?.id}/attachments`;
  const imagePath = (t: SupportDetail, id: string) =>
    `/support/tickets/${t.ticket.id}/attachments/${id}`;
  async function ticketRows(id: string) {
    const [row] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    return row;
  }
  beforeAll(async () => {
    f = await createFacilityOperationsFixture();
    // A second authenticated customer; reuse this fixture account without changing shared fixtures.
    await db.update(users).set({ role: "CUSTOMER" }).where(eq(users.id, f.ids.peerStaff));
    await f.app.register(swaggerPlugin);
    await f.app.register(supportRoutes, { prefix: "/api/support", storage, repository });
    await db
      .insert(checkInSlots)
      .values({ id: slotId, name: "Support fixture", startTime: "09:00", endTime: "10:00" });
    for (const [id, userId, facilityId, unitTypeId] of [
      [bookingId, f.ids.customer, f.facilityId, f.typeId],
      [otherBookingId, f.ids.peerStaff, f.otherFacilityId, f.foreignTypeId],
    ] as const) {
      await db.insert(bookings).values({
        id,
        contactName: "Support customer",
        contactEmail: "booking-contact@example.test",
        contactPhone: "0901234567",
        userId,
        facilityId,
        unitTypeId,
        requestedMonths: 1,
        checkInDate: "2026-10-24",
        checkInSlotId: slotId,
        rentalEndAt: new Date("2026-11-24T00:00:00Z"),
        monthlyRateSnapshot: "1000000",
        rentalFeeAmount: "1000000",
        depositAmount: "1000000",
        totalAmount: "2000000",
      });
    }
    for (const [id, context] of [
      [paymentId, bookingId],
      [otherPaymentId, otherBookingId],
    ] as const) {
      await db.insert(payments).values({
        id,
        bookingId: context,
        holdTokenHash: "support-test",
        provider: "mock",
        paymentCode: id.slice(0, 32),
        providerPaymentId: id,
        idempotencyKey: id,
        totalAmount: "2000000",
        currency: "VND",
        status: "FAILED",
      });
    }
    await f.login();
  });
  afterAll(async () => {
    try {
      if (!f) return;
      await f.app.close();
      const tickets = await db
        .select({ id: supportTickets.id })
        .from(supportTickets)
        .where(inArray(supportTickets.bookingId, [bookingId, otherBookingId]));
      const ids = tickets.map((r) => r.id);
      if (ids.length) {
        await db.delete(notificationOutbox).where(inArray(notificationOutbox.supportTicketId, ids));
        await db.delete(supportIdempotency).where(inArray(supportIdempotency.ticketId, ids));
        await db.delete(supportAttachments).where(inArray(supportAttachments.ticketId, ids));
        await db.delete(supportAudit).where(inArray(supportAudit.ticketId, ids));
        await db.delete(supportMessages).where(inArray(supportMessages.ticketId, ids));
        await db.delete(supportTickets).where(inArray(supportTickets.id, ids));
      }
      await db.delete(payments).where(inArray(payments.id, [paymentId, otherPaymentId]));
      await db.delete(rentals).where(eq(rentals.id, rentalId));
      await db.delete(bookings).where(inArray(bookings.id, [bookingId, otherBookingId]));
      await db.delete(checkInSlots).where(eq(checkInSlots.id, slotId));
      await f.cleanup();
    } finally {
      await queryClient.end();
    }
  });

  test("PAYMENT supports failed payment and cancelled bookings; receipt and audit are atomic", async () => {
    await db.update(bookings).set({ status: "CANCELLED" }).where(eq(bookings.id, bookingId));
    const t = await create({ paymentId });
    expect(t.ticket).toMatchObject({
      bookingId,
      facilityId: f.facilityId,
      status: "OPEN",
      priority: "NORMAL",
      paymentId,
      rentalId: null,
      version: 0,
    });
    expect(Date.parse(t.ticket.actionDueAt) - Date.parse(t.ticket.createdAt)).toBe(12 * 3600000);
    const audit = await db
      .select()
      .from(supportAudit)
      .where(eq(supportAudit.ticketId, t.ticket.id));
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: f.ids.customer, action: "CREATED", nextVersion: 0 });
    const mail = await db
      .select()
      .from(notificationOutbox)
      .where(
        and(
          eq(notificationOutbox.supportTicketId, t.ticket.id),
          eq(notificationOutbox.recipientRole, "CUSTOMER"),
        ),
      );
    expect(mail).toHaveLength(1);
    expect(mail[0]).toMatchObject({
      recipientUserId: f.ids.customer,
      recipientEmail: `${f.ids.customer}@example.test`,
      status: "PENDING",
      eventType: "SUPPORT_CREATED",
    });
    expect(mail[0]?.body).toContain("12");
    await db.update(bookings).set({ status: "DRAFT" }).where(eq(bookings.id, bookingId));
  });

  test("context cannot be forged, and a payment from another booking is rejected", async () => {
    for (const extra of [
      { ownerUserId: f.ids.peerStaff },
      { facilityId: f.otherFacilityId },
      { status: "CLOSED" },
      { priority: "HIGH" },
      { actorId: f.ids.admin },
    ]) {
      const r = await f.api("customer", "POST", "/support/tickets", { ...input(), ...extra });
      expect(r.statusCode, r.body).toBe(400);
    }
    expect(
      (await f.api("customer", "POST", "/support/tickets", input({ bookingId: otherBookingId })))
        .statusCode,
    ).toBe(404);
    expect(
      (await f.api("customer", "POST", "/support/tickets", input({ paymentId: otherPaymentId })))
        .statusCode,
    ).toBe(422);
    expect(
      (await f.api("customer", "POST", "/support/tickets", input({ paymentId: randomUUID() })))
        .statusCode,
    ).toBe(422);
  });

  test("guest, FM, FS, BOM and Admin cannot use the customer endpoints", async () => {
    const t = await create();
    for (const role of [null, "manager", "staff", "bom", "admin"] as const) {
      for (const [method, path, payload] of [
        ["GET", "/support/tickets", undefined],
        ["GET", `/support/tickets/${t.ticket.id}`, undefined],
        ["POST", "/support/tickets", input()],
      ] as const) {
        expect((await f.api(role, method, path, payload)).statusCode).toBe(role ? 403 : 401);
      }
    }
    const trackingOnly = await f.app.inject({
      method: "GET",
      url: `/api/support/tickets/${t.ticket.id}`,
      headers: { cookie: "metastorage_booking_session=not-an-account-session" },
    });
    expect(trackingOnly.statusCode).toBe(401);
  });

  test("concurrent creation retries produce one ticket, initial message, audit and email", async () => {
    const payload = input();
    const responses = await Promise.all(
      Array.from({ length: 3 }, () => f.api("customer", "POST", "/support/tickets", payload)),
    );
    for (const r of responses) expect(r.statusCode, r.body).toBe(201);
    const ids = responses.map((r) => r.json().data.ticket.id);
    expect(new Set(ids).size).toBe(1);
    const id = ids[0];
    expect(
      await db.select().from(supportMessages).where(eq(supportMessages.ticketId, id)),
    ).toHaveLength(1);
    expect(await db.select().from(supportAudit).where(eq(supportAudit.ticketId, id))).toHaveLength(
      1,
    );
    expect(
      await db
        .select()
        .from(notificationOutbox)
        .where(
          and(
            eq(notificationOutbox.supportTicketId, id),
            eq(notificationOutbox.recipientRole, "CUSTOMER"),
          ),
        ),
    ).toHaveLength(1);
    expect(
      (
        await f.api("customer", "POST", "/support/tickets", {
          ...payload,
          subject: "Different request",
        })
      ).statusCode,
    ).toBe(409);
  });

  test("failed receipt persistence rolls back ticket, initial message, audit and idempotency", async () => {
    const payload = input();
    const before = await db
      .select({ id: supportTickets.id })
      .from(supportTickets)
      .where(eq(supportTickets.bookingId, bookingId));
    const fault = spyOn(repository, "receipt").mockImplementationOnce(async () => {
      throw new Error("Injected database failure");
    });
    try {
      expect((await f.api("customer", "POST", "/support/tickets", payload)).statusCode).toBe(500);
    } finally {
      fault.mockRestore();
    }
    expect(
      await db
        .select({ id: supportTickets.id })
        .from(supportTickets)
        .where(eq(supportTickets.bookingId, bookingId)),
    ).toHaveLength(before.length);
    expect(
      await db
        .select()
        .from(supportIdempotency)
        .where(eq(supportIdempotency.idempotencyKey, payload.idempotencyKey)),
    ).toHaveLength(0);
    expect((await f.api("customer", "POST", "/support/tickets", payload)).statusCode).toBe(201);
  });

  test("warehouse categories require actual handover and derive the rental and physical unit", async () => {
    for (const category of ["UNIT", "LOCK", "ACCESS_CODE", "STORED_ITEMS"] as const)
      expect(
        (await f.api("customer", "POST", "/support/tickets", input({ category }))).statusCode,
      ).toBe(409);
    await db.update(bookings).set({ status: "CHECKED_IN" }).where(eq(bookings.id, bookingId));
    await db.update(storageUnits).set({ status: "OCCUPIED" }).where(eq(storageUnits.id, f.unitId));
    await db.insert(rentals).values({
      id: rentalId,
      bookingId,
      facilityId: f.facilityId,
      physicalUnitId: f.unitId,
      startAt: new Date("2026-10-24"),
      expectedEndAt: new Date("2026-11-24"),
      depositAmount: "1000000",
    });
    for (const category of ["UNIT", "LOCK", "ACCESS_CODE", "STORED_ITEMS"] as const) {
      const t = await create({ category });
      expect(t.ticket).toMatchObject({ category, rentalId, storageUnitId: f.unitId });
    }
    expect(
      (await f.api("customer", "POST", "/support/tickets", input({ category: "UNIT", paymentId })))
        .statusCode,
    ).toBe(422);
    const t = await create({ category: "UNIT" });
    await db
      .update(rentals)
      .set({ closedAt: new Date(), status: "CLOSED" })
      .where(eq(rentals.id, rentalId));
    expect(
      (await f.api("customer", "POST", "/support/tickets", input({ category: "UNIT" }))).statusCode,
    ).toBe(409);
    expect((await f.api("customer", "GET", `/support/tickets/${t.ticket.id}`)).statusCode).toBe(
      200,
    );
    await db
      .update(rentals)
      .set({ closedAt: null, status: "ACTIVE" })
      .where(eq(rentals.id, rentalId));
    const [unit] = await db.select().from(storageUnits).where(eq(storageUnits.id, f.unitId));
    const [rental] = await db.select().from(rentals).where(eq(rentals.id, rentalId));
    expect(unit?.status).toBe("OCCUPIED");
    expect(rental?.version).toBe(0);
  });

  test("public replies are idempotent, versioned and never mutate business statuses", async () => {
    const t = await create();
    const payload = { content: "Additional information", version: 0, idempotencyKey: randomUUID() };
    const path = `/support/tickets/${t.ticket.id}/messages`;
    const a = await f.api("customer", "POST", path, payload);
    const b = await f.api("customer", "POST", path, payload);
    expect(a.statusCode, a.body).toBe(201);
    expect(b.json().data.message.id).toBe(a.json().data.message.id);
    expect(a.json().data.ticket).toMatchObject({ status: "OPEN", version: 1 });
    expect(
      (await f.api("customer", "POST", path, { ...payload, idempotencyKey: randomUUID() }))
        .statusCode,
    ).toBe(409);
    expect(
      (await f.api("customer", "POST", path, { ...payload, content: "Different" })).statusCode,
    ).toBe(409);
  });

  test("another customer cannot read or reply using known ticket/message identifiers", async () => {
    const t = await create();
    for (const suffix of ["", "/messages"])
      expect(
        (await f.api("peerStaff", "GET", `/support/tickets/${t.ticket.id}${suffix}`)).statusCode,
      ).toBe(404);
    expect(
      (
        await f.api("peerStaff", "POST", `/support/tickets/${t.ticket.id}/messages`, {
          content: "Cross owner",
          version: 0,
          idempotencyKey: randomUUID(),
        })
      ).statusCode,
    ).toBe(404);
    const own = await f.api(
      "peerStaff",
      "POST",
      "/support/tickets",
      input({ bookingId: otherBookingId }),
    );
    expect(own.statusCode, own.body).toBe(201);
    const list = await f.api("customer", "GET", `/support/tickets?bookingId=${otherBookingId}`);
    expect(list.json().data.items).toHaveLength(0);
  });

  test("ticket keyset pagination remains complete with identical timestamps and new inserts", async () => {
    const group = await Promise.all(
      Array.from({ length: 4 }, () => create({ subject: "Cursor fixture" })),
    );
    const ids = group.map((t) => t.ticket.id);
    await db
      .update(supportTickets)
      .set({ createdAt: new Date("2090-01-01T00:00:00.123Z") })
      .where(inArray(supportTickets.id, ids));
    const first = (await f.api("customer", "GET", "/support/tickets?limit=2")).json().data;
    expect(first.items.map((r: { id: string }) => r.id)).toEqual(
      [...ids].sort().reverse().slice(0, 2),
    );
    await create({ subject: "Inserted between pages" });
    const second = (
      await f.api("customer", "GET", `/support/tickets?limit=2&cursor=${first.nextCursor}`)
    ).json().data;
    expect([...first.items, ...second.items].map((r: { id: string }) => r.id)).toEqual(
      [...ids].sort().reverse(),
    );
    expect((await f.api("customer", "GET", "/support/tickets?cursor=broken")).statusCode).toBe(422);
    expect((await f.api("customer", "GET", "/support/tickets?ownerUserId=forged")).statusCode).toBe(
      400,
    );
  });

  test("public conversation pagination excludes internal notes, reports and their private images", async () => {
    const t = await create();
    const ids = Array.from({ length: 5 }, () => randomUUID());
    await db.insert(supportMessages).values(
      ids.map((id) => ({
        id,
        ticketId: t.ticket.id,
        authorId: f.ids.manager,
        kind: "PUBLIC_REPLY" as const,
        content: "Public response",
        createdAt: new Date("2090-01-01T00:00:00.123Z"),
      })),
    );
    const privateId = randomUUID();
    await db.insert(supportMessages).values([
      {
        id: privateId,
        ticketId: t.ticket.id,
        authorId: f.ids.manager,
        kind: "INTERNAL_NOTE",
        content: "INTERNAL_SECRET",
      },
      {
        ticketId: t.ticket.id,
        authorId: f.ids.staff,
        kind: "STAFF_REPORT",
        content: "PRIVATE_REPORT",
      },
    ]);
    const attachmentId = randomUUID();
    await db.insert(supportAttachments).values({
      id: attachmentId,
      ticketId: t.ticket.id,
      messageId: privateId,
      uploadedBy: f.ids.manager,
      objectKey: randomUUID(),
      originalFilename: "private.png",
      mimeType: "image/png",
      byteSize: png.length,
      checksum: createHash("sha256").update(png).digest("hex"),
    });
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const r = await f.api(
        "customer",
        "GET",
        `/support/tickets/${t.ticket.id}/messages?limit=2${cursor ? `&cursor=${cursor}` : ""}`,
      );
      expect(r.statusCode, r.body).toBe(200);
      expect(r.body).not.toContain("INTERNAL_SECRET");
      expect(r.body).not.toContain("PRIVATE_REPORT");
      expect(r.body).not.toContain("objectKey");
      const page = r.json().data;
      seen.push(...page.items.map((m: { id: string }) => m.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(6);
    expect(new Set(seen).size).toBe(6);
    expect(seen.slice(0, 5)).toEqual([...ids].sort().reverse());
    expect((await f.api("customer", "GET", imagePath(t, attachmentId))).statusCode).toBe(404);
    expect(
      (
        await f.api(
          "customer",
          "POST",
          `/support/tickets/${t.ticket.id}/messages/${privateId}/attachments`,
          imageInput(0),
        )
      ).statusCode,
    ).toBe(404);
  });

  test("private image upload/read round-trips bytes; retries do not duplicate assets", async () => {
    const t = await create(),
      payload = imageInput(0),
      puts = storage.puts;
    const a = await f.api("customer", "POST", uploadPath(t), payload);
    expect(a.statusCode, a.body).toBe(201);
    const b = await f.api("customer", "POST", uploadPath(t), payload);
    expect(b.statusCode, b.body).toBe(201);
    expect(b.json().data.attachment.id).toBe(a.json().data.attachment.id);
    expect(storage.puts).toBe(puts + 1);
    expect(a.body).not.toContain("objectKey");
    expect(a.body).not.toContain("checksum");
    expect(a.body).not.toContain("http");
    const path = imagePath(t, a.json().data.attachment.id);
    const bytes = await f.api("customer", "GET", path);
    expect(bytes.statusCode, bytes.body).toBe(200);
    expect(bytes.rawPayload).toEqual(png);
    expect(bytes.headers["cache-control"]).toBe("private, no-store");
    expect(bytes.headers["x-content-type-options"]).toBe("nosniff");
    expect((await f.api("peerStaff", "GET", path)).statusCode).toBe(404);
    expect((await f.api(null, "GET", path)).statusCode).toBe(401);
    const other = await create();
    expect(
      (await f.api("customer", "GET", imagePath(other, a.json().data.attachment.id))).statusCode,
    ).toBe(404);
    expect(
      (
        await f.api(
          "customer",
          "POST",
          `/support/tickets/${other.ticket.id}/messages/${t.messages.items[0]?.id}/attachments`,
          imageInput(0),
        )
      ).statusCode,
    ).toBe(404);
  });

  test("rejects MIME spoofing, SVG/PDF, path filenames and oversized images before storage", async () => {
    const t = await create(),
      puts = storage.puts;
    for (const extra of [
      { dataBase64: Buffer.from("<svg onload='alert(1)'></svg>").toString("base64") },
      { dataBase64: Buffer.from("%PDF-1.4").toString("base64") },
      { mimeType: "image/jpeg" },
      { dataBase64: Buffer.from([255, 216, 255, 217]).toString("base64"), mimeType: "image/jpeg" },
      { mimeType: "image/svg+xml" },
      { filename: "../escape.png" },
      { dataBase64: Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64") },
    ]) {
      const r = await f.api("customer", "POST", uploadPath(t), { ...imageInput(0), ...extra });
      expect(r.statusCode, r.body).toBe(
        "filename" in extra ||
          ("mimeType" in extra && extra.mimeType === "image/svg+xml") ||
          ("dataBase64" in extra && extra.dataBase64.length > 7_000_000)
          ? 400
          : 422,
      );
    }
    expect(storage.puts).toBe(puts);
  });

  test("ticket lock enforces total ten images under concurrent requests", async () => {
    const t = await create();
    for (let i = 0; i < 9; i++) {
      const r = await f.api("customer", "POST", uploadPath(t), imageInput(i));
      expect(r.statusCode, r.body).toBe(201);
    }
    const results = await Promise.all(
      [1, 2].map(() => f.api("customer", "POST", uploadPath(t), imageInput(9))),
    );
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    const eleventh = await f.api("customer", "POST", uploadPath(t), imageInput(10));
    expect(eleventh.statusCode, eleventh.body).toBe(409);
    expect(
      await db
        .select()
        .from(supportAttachments)
        .where(eq(supportAttachments.ticketId, t.ticket.id)),
    ).toHaveLength(10);
  });

  test("storage failure and database rollback do not lose existing images", async () => {
    const t = await create();
    const first = await f.api("customer", "POST", uploadPath(t), imageInput(0));
    const path = imagePath(t, first.json().data.attachment.id);
    const removalsBeforeFailedUpload = storage.removes.length;
    storage.failPut = true;
    try {
      expect((await f.api("customer", "POST", uploadPath(t), imageInput(1))).statusCode).toBe(500);
    } finally {
      storage.failPut = false;
    }
    expect(storage.removes.length).toBe(removalsBeforeFailedUpload);
    const before = storage.objects.size;
    const fault = spyOn(repository, "insertImage").mockImplementationOnce(async () => {
      throw new Error("Injected metadata failure");
    });
    try {
      expect((await f.api("customer", "POST", uploadPath(t), imageInput(1))).statusCode).toBe(500);
    } finally {
      fault.mockRestore();
    }
    expect(storage.objects.size).toBe(before);
    expect((await f.api("customer", "GET", path)).rawPayload).toEqual(png);
    expect((await ticketRows(t.ticket.id))?.version).toBe(1);
  });

  test("lost COMMIT acknowledgement preserves committed evidence and retry returns it", async () => {
    const t = await create(),
      payload = imageInput(0),
      puts = storage.puts;
    const fault = spyOn(repository, "transaction").mockImplementationOnce(async (fn) => {
      await db.transaction(fn);
      throw new Error("Injected lost commit acknowledgement");
    });
    try {
      expect((await f.api("customer", "POST", uploadPath(t), payload)).statusCode).toBe(500);
    } finally {
      fault.mockRestore();
    }
    const r = await f.api("customer", "POST", uploadPath(t), payload);
    expect(r.statusCode, r.body).toBe(201);
    expect(storage.puts).toBe(puts + 1);
    expect(
      (await f.api("customer", "GET", imagePath(t, r.json().data.attachment.id))).rawPayload,
    ).toEqual(png);
  });

  test("read failure after upload commit preserves the stored image", async () => {
    const t = await create(),
      payload = imageInput(0),
      puts = storage.puts;
    const fault = spyOn(repository, "attachment").mockImplementationOnce(async () => {
      throw new Error("Injected response read failure");
    });
    try {
      expect((await f.api("customer", "POST", uploadPath(t), payload)).statusCode).toBe(500);
    } finally {
      fault.mockRestore();
    }
    const r = await f.api("customer", "POST", uploadPath(t), payload);
    expect(r.statusCode, r.body).toBe(201);
    expect(storage.puts).toBe(puts + 1);
    expect(
      (await f.api("customer", "GET", imagePath(t, r.json().data.attachment.id))).rawPayload,
    ).toEqual(png);
  });

  test("closed history remains readable; new writes stop but successful retries remain safe", async () => {
    const t = await create(),
      payload = imageInput(0);
    const r = await f.api("customer", "POST", uploadPath(t), payload);
    await db
      .update(supportTickets)
      .set({
        status: "CLOSED",
        closedBy: f.ids.customer,
        closedAt: new Date(),
        closureKind: "CUSTOMER_WITHDREW",
        closeReason: "No longer needed",
        version: 2,
      })
      .where(eq(supportTickets.id, t.ticket.id));
    expect((await f.api("customer", "GET", `/support/tickets/${t.ticket.id}`)).statusCode).toBe(
      200,
    );
    expect(
      (await f.api("customer", "GET", imagePath(t, r.json().data.attachment.id))).statusCode,
    ).toBe(200);
    expect((await f.api("customer", "POST", uploadPath(t), imageInput(2))).statusCode).toBe(409);
    expect(
      (
        await f.api("customer", "POST", `/support/tickets/${t.ticket.id}/messages`, {
          content: "New",
          version: 2,
          idempotencyKey: randomUUID(),
        })
      ).statusCode,
    ).toBe(409);
    expect((await f.api("customer", "POST", uploadPath(t), payload)).statusCode).toBe(201);
  });

  test("fresh authorization is rechecked after storage IO and email delivery checks current ownership", async () => {
    const t = await create();
    const r = await f.api("customer", "POST", uploadPath(t), imageInput(0));
    const [mail] = await db
      .select()
      .from(notificationOutbox)
      .where(
        and(
          eq(notificationOutbox.supportTicketId, t.ticket.id),
          eq(notificationOutbox.recipientRole, "CUSTOMER"),
        ),
      );
    if (!mail) throw new Error("Missing receipt");
    const outbox = new OutboxRepository(db);
    expect(await outbox.authorized(mail, new Date())).toBe(true);
    storage.afterGet = async () => {
      await db.update(users).set({ status: "INACTIVE" }).where(eq(users.id, f.ids.customer));
    };
    try {
      expect(
        (await f.api("customer", "GET", imagePath(t, r.json().data.attachment.id))).statusCode,
      ).toBe(404);
      expect(await outbox.authorized(mail, new Date())).toBe(false);
    } finally {
      storage.afterGet = undefined;
      await db.update(users).set({ status: "ACTIVE" }).where(eq(users.id, f.ids.customer));
    }
    await db
      .update(users)
      .set({ email: `${randomUUID()}@example.test` })
      .where(eq(users.id, f.ids.customer));
    try {
      expect(await outbox.authorized(mail, new Date())).toBe(false);
    } finally {
      await db
        .update(users)
        .set({ email: `${f.ids.customer}@example.test` })
        .where(eq(users.id, f.ids.customer));
    }
    await db.update(bookings).set({ userId: f.ids.peerStaff }).where(eq(bookings.id, bookingId));
    try {
      expect(await outbox.authorized(mail, new Date())).toBe(false);
      expect((await f.api("customer", "GET", `/support/tickets/${t.ticket.id}`)).statusCode).toBe(
        404,
      );
      expect((await f.api("peerStaff", "GET", `/support/tickets/${t.ticket.id}`)).statusCode).toBe(
        404,
      );
    } finally {
      await db.update(bookings).set({ userId: f.ids.customer }).where(eq(bookings.id, bookingId));
    }
  });

  test("database constraints reject cross-ticket attachments and incomplete closure metadata", async () => {
    const a = await create(),
      b = await create();
    await expect(
      db
        .insert(supportAttachments)
        .values({
          ticketId: a.ticket.id,
          messageId: b.messages.items[0]?.id ?? randomUUID(),
          uploadedBy: f.ids.customer,
          objectKey: randomUUID(),
          originalFilename: "x.png",
          mimeType: "image/png",
          byteSize: png.length,
          checksum: "a".repeat(64),
        })
        .execute(),
    ).rejects.toThrow();
    await expect(
      db
        .update(supportTickets)
        .set({
          status: "CLOSED",
          closedBy: f.ids.customer,
          closedAt: new Date(),
          closureKind: "CUSTOMER_WITHDREW",
          closeReason: null,
        })
        .where(eq(supportTickets.id, a.ticket.id))
        .execute(),
    ).rejects.toThrow();
  });

  test("JPEG and WebP evidence are recognized by content and retain exact bytes", async () => {
    const t = await create();
    for (const [i, [bytes, mimeType, filename]] of [
      [jpeg, "image/jpeg", "photo.jpg"],
      [webp, "image/webp", "photo.webp"],
    ].entries()) {
      const r = await f.api("customer", "POST", uploadPath(t), {
        ...imageInput(i),
        mimeType,
        filename,
        dataBase64: Buffer.from(bytes).toString("base64"),
      });
      expect(r.statusCode, r.body).toBe(201);
      expect(
        (await f.api("customer", "GET", imagePath(t, r.json().data.attachment.id))).rawPayload,
      ).toEqual(bytes);
    }
  });

  test("private evidence counts toward the same ten-image cap", async () => {
    const t = await create(),
      messageId = randomUUID();
    await db.insert(supportMessages).values({
      id: messageId,
      ticketId: t.ticket.id,
      authorId: f.ids.manager,
      kind: "INTERNAL_NOTE",
      content: "Private evidence",
    });
    await db.insert(supportAttachments).values(
      Array.from({ length: 9 }, () => ({
        ticketId: t.ticket.id,
        messageId,
        uploadedBy: f.ids.manager,
        objectKey: randomUUID(),
        originalFilename: "note.png",
        mimeType: "image/png",
        byteSize: png.length,
        checksum: createHash("sha256").update(png).digest("hex"),
      })),
    );
    expect((await f.api("customer", "POST", uploadPath(t), imageInput(0))).statusCode).toBe(201);
    expect((await f.api("customer", "POST", uploadPath(t), imageInput(1))).statusCode).toBe(409);
  });

  test("corrupted stored evidence fails closed without returning bytes", async () => {
    const t = await create();
    const uploaded = await f.api("customer", "POST", uploadPath(t), imageInput(0));
    const id = uploaded.json().data.attachment.id;
    const [row] = await db.select().from(supportAttachments).where(eq(supportAttachments.id, id));
    if (!row) throw new Error("Missing image metadata");
    storage.objects.set(row.objectKey, Buffer.from("corrupted-image"));
    const response = await f.api("customer", "GET", imagePath(t, id));
    expect(response.statusCode, response.body).toBe(503);
    expect(response.body).not.toContain("corrupted-image");
  });

  test("worker retries the automatic receipt with a stable delivery ID", async () => {
    const t = await create();
    const [row] = await db
      .select()
      .from(notificationOutbox)
      .where(
        and(
          eq(notificationOutbox.supportTicketId, t.ticket.id),
          eq(notificationOutbox.recipientRole, "CUSTOMER"),
        ),
      );
    if (!row) throw new Error("Missing receipt");
    const deliveries: string[] = [];
    const service = new OutboxService(new OutboxRepository(db), {
      send: async (mail) => {
        if (mail.deliveryId === `notification-${row.id}`) {
          deliveries.push(mail.deliveryId);
          if (deliveries.length === 1) throw new Error("Injected mail provider timeout");
          expect(mail.recipientEmail).toBe(`${f.ids.customer}@example.test`);
          expect(mail.text).toContain(t.ticket.id);
        }
        return { providerMessageId: randomUUID() };
      },
    });
    const now = new Date();
    await service.dispatch(now, f.facilityId, 1000);
    await service.dispatch(new Date(now.getTime() + 60000), f.facilityId, 1000);
    expect(deliveries).toEqual([`notification-${row.id}`, `notification-${row.id}`]);
    const [sent] = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.id, row.id));
    expect(sent?.status).toBe("SENT");
    expect(sent?.attempts).toBe(2);
  });

  test("shared API client completes customer create/reply/image/read over HTTP", async () => {
    const address = await f.app.listen({ host: "127.0.0.1", port: 0 });
    const login = await f.app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { origin: "http://localhost:3000" },
      payload: { email: `${f.ids.customer}@example.test`, password: "FacilityOperationsTest123!" },
    });
    expect(login.statusCode, login.body).toBe(200);
    const http = createHttpClient({
      baseURL: `${address}/api`,
      tokenProvider: {
        getAccessToken: () => null,
        getRefreshToken: () => null,
        updateTokens: () => {},
        clearSession: () => {},
      },
    });
    http.defaults.headers.common.Cookie = login.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const client = createMetastorageApiClient(http, "better-auth");
    const t = await client.support.create(input());
    expect((await client.support.detail(t.ticket.id)).ticket.id).toBe(t.ticket.id);
    expect(
      (await client.support.list({ bookingId })).items.some((item) => item.id === t.ticket.id),
    ).toBe(true);
    const r = await client.support.reply(t.ticket.id, {
      content: "HTTP exchange",
      version: 0,
      idempotencyKey: randomUUID(),
    });
    expect(
      (await client.support.messages(t.ticket.id)).items.some((item) => item.id === r.message.id),
    ).toBe(true);
    const image = await client.support.uploadImage(t.ticket.id, r.message.id, imageInput(1));
    const bytes = await client.support.image(t.ticket.id, image.attachment.id);
    expect(Buffer.from(bytes)).toEqual(png);
  });

  test("Swagger publishes customer schemas with session auth and no private storage keys", async () => {
    const r = await f.app.inject({ method: "GET", url: "/docs/json" });
    expect(r.statusCode, r.body).toBe(200);
    const paths = r.json().paths;
    expect(paths["/api/support/tickets"].post.security).toEqual([{ sessionAuth: [] }]);
    expect(
      paths["/api/support/tickets/{ticketId}/messages/{messageId}/attachments"].post,
    ).toBeDefined();
    expect(JSON.stringify(paths["/api/support/tickets/{ticketId}"])).not.toContain("objectKey");
  });
});
