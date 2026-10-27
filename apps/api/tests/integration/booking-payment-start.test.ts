import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  spyOn,
  test,
} from "bun:test";
import { randomUUID } from "node:crypto";
import {
  accounts,
  bookings,
  capacityAllocations,
  checkInSlots,
  checkInVerifications,
  db,
  eq,
  facilities,
  facilityAssignments,
  handoverInspections,
  inArray,
  notificationOutbox,
  paymentProviderEvents,
  payments,
  rentals,
  reservationDrafts,
  sessions,
  storageUnits,
  systemSettings,
  unitAssignments,
  unitTypes,
  users,
} from "@metastorage/database";
import { bookingDeliveryKey, bookingMagicKey } from "@metastorage/shared/booking-access";
import { decryptMailPayload, type MailJobData, mailJobId } from "@metastorage/shared/mail";
import { Queue } from "bullmq";
import Fastify from "fastify";
import fp from "fastify-plugin";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import Redis from "ioredis";
import { BookingMailService } from "../../../worker/src/notifications/booking-mail.service";
import { OutboxRepository } from "../../../worker/src/notifications/outbox.repository";
import { OutboxService } from "../../../worker/src/notifications/outbox.service";
import { expireCapacityHolds } from "../../src/common/cron/expire-capacity-holds";
import { cronPlugin } from "../../src/common/cron/plugin";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { env } from "../../src/config/env";
import { auth } from "../../src/modules/auth/auth";
import { authPlugin } from "../../src/modules/auth/auth.guard";
import { authRoutes } from "../../src/modules/auth/auth.routes";
import { BookingsRepository } from "../../src/modules/bookings/bookings.repository";
import { bookingsRoutes } from "../../src/modules/bookings/bookings.routes";
import { checkInsRoutes } from "../../src/modules/check-ins/check-ins.routes";
import { inspectionsRoutes } from "../../src/modules/inspections/inspections.routes";
import { paymentsRoutes } from "../../src/modules/payments/payments.routes";
import { createTestUnitType, deleteTestUnitTypes } from "../fixtures/facility-catalog";
import { assertTestDatabase } from "../fixtures/test-database";

const testUrl = process.env.BOOKING_TEST_DATABASE_URL;
const redisUrl = process.env.REDIS_TEST_URL;
const fixtureMailSecret = "booking-flow-test-magic-secret-32-characters";
const ids = {
  facility: randomUUID(),
  type: randomUUID(),
  unit: randomUUID(),
  extraUnit: randomUUID(),
  slot: randomUUID(),
  user: randomUUID(),
  otherCustomer: randomUUID(),
  admin: randomUUID(),
  staff: randomUUID(),
  manager: randomUUID(),
  lastSlot: randomUUID(),
};
const contact = { fullName: "Payment guest", email: "guest@example.test", phone: "+84901234567" };
const checkInDate = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
const app = Fastify();
const previous = {
  provider: env.PAYMENT_PROVIDER,
  merchant: env.SEPAY_MERCHANT_ID,
  secret: env.SEPAY_SECRET_KEY,
  magicSecret: process.env.BOOKING_MAGIC_LINK_SECRET,
};
let created = false;
const webhookEventIds: string[] = [];
let adminCookie = "";
let customerCookie = "";
let otherCustomerCookie = "";
let staffCookie = "";
let managerCookie = "";
let redis: Redis | undefined;
let mailQueue: Queue<MailJobData> | undefined;
let createdPricing = false;
const providerOrders = new Map<string, unknown>();
const providerRequests: string[] = [];
const originalFetch = globalThis.fetch;
let providerFetch: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

function capturedOrder(paymentCode: string, overrides: Record<string, unknown> = {}) {
  const orderId = `SEPAY-${randomUUID()}`;
  webhookEventIds.push(`ORDER:${orderId}`);
  return {
    data: {
      order_id: orderId,
      order_invoice_number: paymentCode,
      order_status: "CAPTURED",
      order_amount: "3000000.00",
      order_currency: "VND",
      transactions: [],
      ...overrides,
    },
  };
}

async function dispatchFixtureMail() {
  if (!redis || !mailQueue) return;
  const repository = new OutboxRepository(db);
  const bookingMail = new BookingMailService(repository, {
    redis,
    queue: mailQueue,
    secret: process.env.BOOKING_MAGIC_LINK_SECRET as string,
    publicAppUrl: process.env.PUBLIC_APP_URL ?? "http://localhost:3000",
    qrTokenSecret: process.env.QR_TOKEN_SECRET ?? "storex-dev-qr-secret",
  });
  await new OutboxService(
    repository,
    {
      async send() {
        return { providerMessageId: randomUUID() };
      },
    },
    bookingMail,
  ).dispatch(new Date(), ids.facility, 100);
}

async function clearBookings() {
  const ownOutbox = await db
    .select()
    .from(notificationOutbox)
    .where(eq(notificationOutbox.facilityId, ids.facility));
  if (redis)
    for (const row of ownOutbox) {
      if (!row.bookingEmail) continue;
      const keys = [bookingDeliveryKey(row.bookingId)];
      if (row.mailPayload) {
        const decoded = JSON.parse(
          decryptMailPayload(row.mailPayload, fixtureMailSecret, row.bookingId),
        );
        keys.push(bookingMagicKey(new URL(decoded.trackingUrl).hash.slice("#token=".length)));
      }
      await redis.del(...keys);
    }
  await db.delete(notificationOutbox).where(eq(notificationOutbox.facilityId, ids.facility));
  await db.delete(rentals).where(eq(rentals.facilityId, ids.facility));
  await db.delete(handoverInspections).where(eq(handoverInspections.facilityId, ids.facility));
  await db.delete(checkInVerifications).where(eq(checkInVerifications.facilityId, ids.facility));
  if (webhookEventIds.length) {
    await db
      .delete(paymentProviderEvents)
      .where(inArray(paymentProviderEvents.providerEventId, webhookEventIds));
    webhookEventIds.length = 0;
  }
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.facilityId, ids.facility));
  if (rows.length)
    await db.delete(payments).where(
      inArray(
        payments.bookingId,
        rows.map((row) => row.id),
      ),
    );
  await db.delete(capacityAllocations).where(eq(capacityAllocations.facilityId, ids.facility));
  await db.delete(bookings).where(eq(bookings.facilityId, ids.facility));
}

async function draft() {
  const response = await app.inject({
    method: "POST",
    url: "/api/bookings/drafts",
    headers: { cookie: customerCookie },
    payload: {
      facilityId: ids.facility,
      unitTypeId: ids.type,
      checkInSlotId: ids.slot,
      checkInDate,
      durationMonths: 2,
    },
  });
  expect(response.statusCode).toBe(201);
  return response.json().data as {
    id: string;
    rentalEndAt: string;
    checkInAt: string;
  };
}

function pay(booking: { id: string }, key = randomUUID(), extra: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: `/api/bookings/${booking.id}/pay`,
    headers: { cookie: customerCookie },
    payload: {
      idempotencyKey: key,
      contactPhone: contact.phone,
      ...extra,
    },
  });
}

function webhook(
  paymentCode: string,
  overrides: Record<string, unknown> = {},
  eventId = randomUUID(),
) {
  webhookEventIds.push(eventId);
  return app.inject({
    method: "POST",
    url: "/api/payments/webhooks/sepay",
    headers: { "x-secret-key": "test-only-sepay-secret" },
    payload: {
      notification_type: "ORDER_PAID",
      order: {
        order_invoice_number: paymentCode,
        order_status: "CAPTURED",
        order_currency: "VND",
        order_amount: "3000000.00",
      },
      transaction: {
        transaction_id: eventId,
        transaction_amount: "3000000.00",
        transaction_status: "APPROVED",
        transaction_type: "PAYMENT",
        transaction_currency: "VND",
      },
      ...overrides,
    },
  });
}

describe.skipIf(!testUrl)("Start booking payment with isolated PostgreSQL", () => {
  beforeAll(async () => {
    assertTestDatabase(testUrl, process.env, true);
    const seeded = await db
      .insert(systemSettings)
      .values({ key: "DEPOSIT_MONTHS", value: 1, description: "Deposit test setting", version: 1 })
      .onConflictDoNothing()
      .returning();
    createdPricing = seeded.length > 0;
    env.PAYMENT_PROVIDER = "sepay";
    env.SEPAY_MERCHANT_ID = "test-merchant";
    env.SEPAY_SECRET_KEY = "test-only-sepay-secret";
    providerFetch = spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (!url.startsWith("https://pgapi-sandbox.sepay.vn/v1/order/detail/"))
        return originalFetch(input, init);
      expect(new Headers(init?.headers).get("authorization")).toBe(
        `Basic ${Buffer.from("test-merchant:test-only-sepay-secret").toString("base64")}`,
      );
      expect(init?.signal).toBeDefined();
      const invoice = decodeURIComponent(url.split("/").at(-1) ?? "");
      providerRequests.push(invoice);
      const configured = providerOrders.get(invoice);
      const body = Array.isArray(configured) ? configured.shift() : configured;
      if (body instanceof Error) throw body;
      return new Response(JSON.stringify(body ?? {}), { status: body ? 200 : 404 });
    });
    if (redisUrl) {
      process.env.BOOKING_MAGIC_LINK_SECRET = fixtureMailSecret;
      redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
      mailQueue = new Queue<MailJobData>(`test-booking-flow-${ids.facility}`, {
        connection: redis,
      });
      app.decorate("redis", redis);
      app.decorate("mailQueue", mailQueue);
    }
    const password = "Manual-refund-test-123";
    const passwordHash = await (await auth.$context).password.hash(password);
    await db.transaction(async (tx) => {
      await tx.insert(users).values([
        {
          id: ids.otherCustomer,
          name: "Other customer",
          email: `${ids.otherCustomer}@example.test`,
          role: "CUSTOMER",
          status: "ACTIVE",
          emailVerified: true,
        },
        {
          id: ids.user,
          name: "Saved booking owner",
          email: `${ids.user}@example.test`,
          role: "CUSTOMER",
          status: "ACTIVE",
          emailVerified: true,
        },
        {
          id: ids.admin,
          name: "Refund admin",
          email: `${ids.admin}@example.test`,
          role: "SYSTEM_ADMIN",
          status: "ACTIVE",
          emailVerified: true,
        },
        {
          id: ids.staff,
          name: "Assigned check-in staff",
          email: `${ids.staff}@example.test`,
          role: "FACILITY_STAFF",
          status: "ACTIVE",
          emailVerified: true,
        },
        {
          id: ids.manager,
          name: "Booking facility manager",
          email: `${ids.manager}@example.test`,
          role: "FACILITY_MANAGER",
          status: "ACTIVE",
          emailVerified: true,
        },
      ]);
      await tx.insert(accounts).values(
        [ids.user, ids.otherCustomer, ids.admin, ids.staff, ids.manager].map((userId) => ({
          id: randomUUID(),
          userId,
          accountId: userId,
          providerId: "credential",
          password: passwordHash,
        })),
      );
      await tx
        .insert(facilities)
        .values({ id: ids.facility, code: ids.facility, name: "Payment test", address: "Test" });
      await createTestUnitType(tx, {
        facilityId: ids.facility,
        id: ids.type,
        code: ids.type,
        name: "Payment type",
        sizeLabel: "S",
        lengthM: 1,
        widthM: 1,
        heightM: 1,
        monthlyPrice: 1000000,
      });

      await tx
        .insert(facilityAssignments)
        .values({ userId: ids.staff, facilityId: ids.facility, role: "FACILITY_STAFF" });
      await tx
        .insert(facilityAssignments)
        .values({ userId: ids.manager, facilityId: ids.facility, role: "FACILITY_MANAGER" });
      await tx
        .insert(storageUnits)
        .values({ id: ids.unit, code: ids.unit, facilityId: ids.facility, unitTypeId: ids.type });
      await tx
        .insert(checkInSlots)
        .values({ id: ids.slot, name: "Payment slot", startTime: "09:00", endTime: "10:00" });
    });
    created = true;
    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    await app.register(authPlugin);
    await app.register(authRoutes, { prefix: "/api/auth" });
    await app.register(bookingsRoutes, { prefix: "/api" });
    await app.register(paymentsRoutes, { prefix: "/api" });
    await app.register(checkInsRoutes, { prefix: "/api" });
    await app.register(inspectionsRoutes, { prefix: "/api" });
    await app.ready();
    for (const userId of [ids.user, ids.otherCustomer, ids.admin, ids.staff, ids.manager]) {
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        payload: { email: `${userId}@example.test`, password },
      });
      expect(login.statusCode).toBe(200);
      const cookie = login.cookies.map((item) => `${item.name}=${item.value}`).join("; ");
      if (userId === ids.otherCustomer) otherCustomerCookie = cookie;
      else if (userId === ids.admin) adminCookie = cookie;
      else if (userId === ids.staff) staffCookie = cookie;
      else if (userId === ids.manager) managerCookie = cookie;
      else customerCookie = cookie;
    }
    await db
      .update(sessions)
      .set({ expiresAt: new Date("2100-01-01T00:00:00Z") })
      .where(
        inArray(sessions.userId, [ids.user, ids.otherCustomer, ids.admin, ids.staff, ids.manager]),
      );
  });

  beforeEach(async () => {
    setSystemTime();
    providerOrders.clear();
    providerRequests.length = 0;
    await mailQueue?.obliterate({ force: true });
    await clearBookings();
    await db.delete(storageUnits).where(eq(storageUnits.id, ids.extraUnit));
    await db.delete(checkInSlots).where(eq(checkInSlots.id, ids.lastSlot));
    await db
      .update(unitTypes)
      .set({ monthlyPrice: 1000000, isActive: true })
      .where(eq(unitTypes.id, ids.type));
    await db.update(facilities).set({ isActive: true }).where(eq(facilities.id, ids.facility));
    await db.update(storageUnits).set({ status: "AVAILABLE" }).where(eq(storageUnits.id, ids.unit));
  });

  afterAll(async () => {
    providerFetch?.mockRestore();
    setSystemTime();
    await app.close();
    env.PAYMENT_PROVIDER = previous.provider;
    env.SEPAY_MERCHANT_ID = previous.merchant;
    env.SEPAY_SECRET_KEY = previous.secret;
    if (previous.magicSecret === undefined) delete process.env.BOOKING_MAGIC_LINK_SECRET;
    else process.env.BOOKING_MAGIC_LINK_SECRET = previous.magicSecret;
    await mailQueue?.obliterate({ force: true });
    await mailQueue?.close();
    if (!created) {
      await redis?.quit();
      return;
    }
    await clearBookings();
    await redis?.quit();
    await db.delete(storageUnits).where(eq(storageUnits.id, ids.extraUnit));
    await db.delete(storageUnits).where(eq(storageUnits.id, ids.unit));
    await deleteTestUnitTypes(db, eq(unitTypes.id, ids.type));

    await db.delete(facilities).where(eq(facilities.id, ids.facility));
    await db.delete(checkInSlots).where(eq(checkInSlots.id, ids.slot));
    await db.delete(checkInSlots).where(eq(checkInSlots.id, ids.lastSlot));
    await db.delete(users).where(eq(users.id, ids.user));
    await db.delete(users).where(eq(users.id, ids.otherCustomer));
    await db.delete(users).where(eq(users.id, ids.admin));
    await db.delete(users).where(eq(users.id, ids.staff));
    await db.delete(users).where(eq(users.id, ids.manager));
    if (createdPricing)
      await db.delete(systemSettings).where(eq(systemSettings.key, "DEPOSIT_MONTHS"));
  });

  test("customer cancellation refunds only snapshotted rent, forfeits deposit and releases capacity atomically", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    expect((await webhook(payment.paymentCode)).statusCode).toBe(200);
    await db.update(unitTypes).set({ monthlyPrice: 9000000 }).where(eq(unitTypes.id, ids.type));
    await db
      .update(bookings)
      .set({ assignedStaffId: ids.staff })
      .where(eq(bookings.id, booking.id));
    await db
      .insert(unitAssignments)
      .values({ bookingId: booking.id, physicalUnitId: ids.unit, assignedBy: ids.manager });
    const cancel = () =>
      app.inject({
        method: "POST",
        url: `/api/bookings/${booking.id}/cancel`,
        headers: { cookie: customerCookie },
      });
    const responses = await Promise.all([cancel(), cancel()]);
    expect(responses.map((r) => r.statusCode)).toEqual([200, 200]);
    expect(responses[0].json().data).toEqual(responses[1].json().data);
    expect(responses[0].json().data).toMatchObject({
      bookingId: booking.id,
      status: "CANCELLED",
      payment: {
        paymentId: payment.paymentId,
        status: "REFUND_PENDING",
        refundAmount: "2000000.00",
        depositForfeitedAmount: "1000000.00",
        currency: "VND",
      },
    });
    const [saved] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(saved.status).toBe("CANCELLED");
    expect(saved.assignedStaffId).toBeNull();
    const [paid] = await db.select().from(payments).where(eq(payments.id, payment.paymentId));
    expect(paid).toMatchObject({
      totalAmount: "3000000.00",
      refundAmount: "2000000.00",
      depositForfeitedAmount: "1000000.00",
      refundReason: "CUSTOMER_CANCELLATION",
      status: "REFUND_PENDING",
    });
    expect(
      (
        await db
          .select()
          .from(capacityAllocations)
          .where(eq(capacityAllocations.referenceId, booking.id))
      )[0].status,
    ).toBe("RELEASED");
    expect(
      (await db.select().from(unitAssignments).where(eq(unitAssignments.bookingId, booking.id)))[0]
        .status,
    ).toBe("CANCELLED");
    const pending = await app.inject({
      method: "GET",
      url: "/api/payments/refunds",
      headers: { cookie: adminCookie },
    });
    expect(
      pending
        .json()
        .data.find((item: { paymentId: string }) => item.paymentId === payment.paymentId),
    ).toMatchObject({ amount: "2000000.00", depositForfeitedAmount: "1000000.00" });
    const confirm = await app.inject({
      method: "POST",
      url: `/api/payments/${payment.paymentId}/refund/confirm`,
      headers: { cookie: adminCookie },
      payload: { reference: "rent-only-refund" },
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().data).toMatchObject({
      amount: "2000000.00",
      depositForfeitedAmount: "1000000.00",
      status: "REFUNDED",
    });
    const status = await app.inject({
      method: "GET",
      url: `/api/payments/${payment.paymentId}/status`,
      headers: { cookie: customerCookie },
    });
    expect(status.json().data.refund).toMatchObject({
      amount: "2000000.00",
      depositForfeitedAmount: "1000000.00",
    });
    expect((await cancel()).json().data.payment.status).toBe("REFUNDED");
    expect((await webhook(payment.paymentCode)).statusCode).toBe(200);
    expect(
      (await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0].refundAmount,
    ).toBe("2000000.00");
    const replacement = await draft();
    expect((await pay(replacement)).statusCode).toBe(201);
  });

  test("cancellation requires the active customer owner", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    await webhook(payment.paymentCode);
    const url = `/api/bookings/${booking.id}/cancel`;
    for (const [headers, status] of [
      [{}, 401],
      [{ "x-booking-access-token": "b".repeat(64) }, 401],
      [{ cookie: adminCookie }, 403],
      [{ cookie: staffCookie }, 403],
      [{ cookie: otherCustomerCookie }, 404],
    ] as const) {
      const response = await app.inject({ method: "POST", url, headers });
      expect(response.statusCode).toBe(status);
      expect(response.headers["cache-control"]).toBe("no-store");
    }
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0].status).toBe(
      "CONFIRMED",
    );
    expect(
      (await app.inject({ method: "POST", url, headers: { cookie: customerCookie } })).statusCode,
    ).toBe(200);
  });

  test("cancellation rejects unpaid drafts and bookings already handed over", async () => {
    const booking = await draft();
    const cancel = () =>
      app.inject({
        method: "POST",
        url: `/api/bookings/${booking.id}/cancel`,
        headers: { cookie: customerCookie },
      });
    expect((await cancel()).statusCode).toBe(409);
    const payment = (await pay(booking)).json().data;
    expect((await cancel()).statusCode).toBe(409);
    await webhook(payment.paymentCode);
    await db.update(bookings).set({ status: "CHECKED_IN" }).where(eq(bookings.id, booking.id));
    expect((await cancel()).statusCode).toBe(409);
    expect(
      (await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0].status,
    ).toBe("SUCCEEDED");
  });

  test("cancellation after the final slot cutoff cannot turn an absent booking into CANCELLED", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    await webhook(payment.paymentCode);
    setSystemTime(new Date(`${checkInDate}T23:59:59+07:00`));
    const response = await app.inject({
      method: "POST",
      url: `/api/bookings/${booking.id}/cancel`,
      headers: { cookie: customerCookie },
    });
    expect(response.statusCode).toBe(409);
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0].status).toBe(
      "CONFIRMED",
    );
  });

  test("NO_SHOW runs at the final slot end, includes VERIFIED bookings and retains rent-only refund on retries", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    await webhook(payment.paymentCode);
    await db
      .insert(checkInSlots)
      .values({ id: ids.lastSlot, name: "Last slot", startTime: "17:00", endTime: "18:00" });
    await db
      .update(bookings)
      .set({ assignedStaffId: ids.staff })
      .where(eq(bookings.id, booking.id));
    await db
      .insert(unitAssignments)
      .values({ bookingId: booking.id, physicalUnitId: ids.unit, assignedBy: ids.manager });
    setSystemTime(new Date(booking.checkInAt));
    const verify = await app.inject({
      method: "POST",
      url: `/api/check-ins/${booking.id}/confirm`,
      headers: { cookie: staffCookie },
    });
    expect(verify.statusCode).toBe(200);
    const repository = new BookingsRepository(db);
    expect(
      await repository.sweepNoShows(new Date(`${checkInDate}T17:59:59.999+07:00`), ids.facility),
    ).toEqual({
      processed: 0,
    });
    const cutoff = new Date(`${checkInDate}T18:00:00+07:00`);
    setSystemTime(cutoff);
    const results = await Promise.all([
      repository.sweepNoShows(cutoff, ids.facility),
      repository.sweepNoShows(cutoff, ids.facility),
    ]);
    expect(results.reduce((sum, r) => sum + r.processed, 0)).toBe(1);
    const [saved] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(saved).toMatchObject({ status: "NO_SHOW", assignedStaffId: null, updatedAt: cutoff });
    const [refund] = await db.select().from(payments).where(eq(payments.id, payment.paymentId));
    expect(refund).toMatchObject({
      status: "REFUND_PENDING",
      refundReason: "NO_SHOW",
      totalAmount: "3000000.00",
      refundAmount: "2000000.00",
      depositForfeitedAmount: "1000000.00",
    });
    expect(
      (
        await db
          .select()
          .from(checkInVerifications)
          .where(eq(checkInVerifications.bookingId, booking.id))
      )[0],
    ).toMatchObject({ status: "INVALIDATED", invalidatedAt: cutoff });
    expect(
      (await db.select().from(unitAssignments).where(eq(unitAssignments.bookingId, booking.id)))[0]
        .status,
    ).toBe("CANCELLED");
    expect(
      (
        await db
          .select()
          .from(capacityAllocations)
          .where(eq(capacityAllocations.referenceId, booking.id))
      )[0].status,
    ).toBe("RELEASED");
    expect(await repository.sweepNoShows(new Date(cutoff.getTime() + 60000), ids.facility)).toEqual(
      {
        processed: 0,
      },
    );
    expect((await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0]).toEqual(
      refund,
    );
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/bookings/${booking.id}/cancel`,
          headers: { cookie: customerCookie },
        })
      ).statusCode,
    ).toBe(409);
    expect((await webhook(payment.paymentCode)).statusCode).toBe(200);
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0].status).toBe(
      "NO_SHOW",
    );
  });

  test("NO_SHOW skips unpaid drafts and CHECKED_IN bookings", async () => {
    const unpaid = await draft();
    const paid = await draft();
    const payment = (await pay(paid)).json().data;
    await webhook(payment.paymentCode);
    await db.update(bookings).set({ status: "CHECKED_IN" }).where(eq(bookings.id, paid.id));
    expect(
      await new BookingsRepository(db).sweepNoShows(
        new Date(`${checkInDate}T23:59:59+07:00`),
        ids.facility,
      ),
    ).toEqual({ processed: 0 });
    expect((await db.select().from(bookings).where(eq(bookings.id, unpaid.id)))[0].status).toBe(
      "DRAFT",
    );
    expect(
      (await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0].status,
    ).toBe("SUCCEEDED");
  });

  test("staff lookup after deadline uses the same atomic NO_SHOW and refund transaction as cron", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    await webhook(payment.paymentCode);
    await db
      .update(bookings)
      .set({ assignedStaffId: ids.staff })
      .where(eq(bookings.id, booking.id));
    const [saved] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    setSystemTime(new Date(`${checkInDate}T23:59:59+07:00`));
    const lookup = await app.inject({
      method: "POST",
      url: "/api/check-ins/lookup",
      headers: { cookie: staffCookie },
      payload: { type: "BOOKING_CODE", value: saved.bookingCode },
    });
    expect(lookup.statusCode).toBe(200);
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0].status).toBe(
      "NO_SHOW",
    );
    expect(
      (await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0],
    ).toMatchObject({
      status: "REFUND_PENDING",
      refundAmount: "2000000.00",
      depositForfeitedAmount: "1000000.00",
    });
  });

  test("cancellation after VERIFIED invalidates verification and wins atomically against check-in retries", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    await webhook(payment.paymentCode);
    await db
      .update(bookings)
      .set({ assignedStaffId: ids.staff })
      .where(eq(bookings.id, booking.id));
    await db
      .insert(unitAssignments)
      .values({ bookingId: booking.id, physicalUnitId: ids.unit, assignedBy: ids.manager });
    setSystemTime(new Date(booking.checkInAt));
    const checkIn = () =>
      app.inject({
        method: "POST",
        url: `/api/check-ins/${booking.id}/confirm`,
        headers: { cookie: staffCookie },
      });
    expect((await checkIn()).statusCode).toBe(200);
    const [cancel, retry] = await Promise.all([
      app.inject({
        method: "POST",
        url: `/api/bookings/${booking.id}/cancel`,
        headers: { cookie: customerCookie },
      }),
      checkIn(),
    ]);
    expect(cancel.statusCode).toBe(200);
    expect([200, 403]).toContain(retry.statusCode);
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0].status).toBe(
      "CANCELLED",
    );
    expect(
      (
        await db
          .select()
          .from(checkInVerifications)
          .where(eq(checkInVerifications.bookingId, booking.id))
      )[0].status,
    ).toBe("INVALIDATED");
    expect((await checkIn()).statusCode).toBe(403);
  });

  async function readyHandover(bookingId: string) {
    await db.update(bookings).set({ assignedStaffId: ids.staff }).where(eq(bookings.id, bookingId));
    const [assignment] = await db
      .insert(unitAssignments)
      .values({ bookingId, physicalUnitId: ids.unit, assignedBy: ids.manager })
      .returning();
    const verified = await app.inject({
      method: "POST",
      url: `/api/check-ins/${bookingId}/confirm`,
      headers: { cookie: staffCookie },
    });
    expect(verified.statusCode).toBe(200);
    const [verification] = await db
      .select()
      .from(checkInVerifications)
      .where(eq(checkInVerifications.bookingId, bookingId));
    const [inspection] = await db
      .insert(handoverInspections)
      .values({
        bookingId,
        facilityId: ids.facility,
        physicalUnitId: ids.unit,
        unitAssignmentId: assignment.id,
        verificationId: verification.id,
        unitCode: ids.unit,
        status: "COMPLETED",
        correctUnit: true,
        conditionNotes: "Ready fixture",
        completedAt: new Date(),
        completedBy: ids.staff,
        createdBy: ids.staff,
      })
      .returning();
    return inspection;
  }

  test("cancellation racing handover has exactly one outcome: active rental or rent-only refund", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    await webhook(payment.paymentCode);
    setSystemTime(new Date(booking.checkInAt));
    const inspection = await readyHandover(booking.id);
    const [cancel, handover] = await Promise.all([
      app.inject({
        method: "POST",
        url: `/api/bookings/${booking.id}/cancel`,
        headers: { cookie: customerCookie },
      }),
      app.inject({
        method: "POST",
        url: `/api/inspections/${inspection.id}/handover`,
        headers: { cookie: staffCookie },
        payload: { version: inspection.version },
      }),
    ]);
    const [saved] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    const [paid] = await db.select().from(payments).where(eq(payments.id, payment.paymentId));
    const active = await db.select().from(rentals).where(eq(rentals.bookingId, booking.id));
    if (saved.status === "CANCELLED") {
      expect(cancel.statusCode).toBe(200);
      expect([403, 409]).toContain(handover.statusCode);
      expect(active).toHaveLength(0);
      expect(paid.status).toBe("REFUND_PENDING");
    } else {
      expect(saved.status).toBe("CHECKED_IN");
      expect(handover.statusCode).toBe(200);
      expect(cancel.statusCode).toBe(409);
      expect(active).toHaveLength(1);
      expect(paid.status).toBe("SUCCEEDED");
    }
  });

  test("handover rejects the exact deadline before cron runs; NO_SHOW can safely race the request", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    await webhook(payment.paymentCode);
    await db
      .insert(checkInSlots)
      .values({ id: ids.lastSlot, name: "Final slot", startTime: "17:00", endTime: "18:00" });
    setSystemTime(new Date(booking.checkInAt));
    const inspection = await readyHandover(booking.id);
    const handover = () =>
      app.inject({
        method: "POST",
        url: `/api/inspections/${inspection.id}/handover`,
        headers: { cookie: staffCookie },
        payload: { version: inspection.version },
      });
    const cutoff = new Date(`${checkInDate}T18:00:00+07:00`);
    setSystemTime(cutoff);
    expect((await handover()).statusCode).toBe(409);
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0].status).toBe(
      "CONFIRMED",
    );
    const [sweep, response] = await Promise.all([
      new BookingsRepository(db).sweepNoShows(cutoff, ids.facility),
      handover(),
    ]);
    expect(sweep.processed).toBe(1);
    expect([403, 409]).toContain(response.statusCode);
    expect(await db.select().from(rentals).where(eq(rentals.bookingId, booking.id))).toHaveLength(
      0,
    );
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0].status).toBe(
      "NO_SHOW",
    );
  });

  test("NO_SHOW cron catches overdue bookings when the API starts", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    await webhook(payment.paymentCode);
    setSystemTime(new Date(`${checkInDate}T23:59:59+07:00`));
    const scheduled = Fastify();
    scheduled.register(
      fp(
        async (server) => {
          server.decorate("db", db);
        },
        { name: "database-plugin" },
      ),
    );
    scheduled.register(cronPlugin, { facilityId: ids.facility });
    try {
      await scheduled.ready();
      expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0].status).toBe(
        "NO_SHOW",
      );
      expect(
        (await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0]
          .refundAmount,
      ).toBe("2000000.00");
    } finally {
      await scheduled.close();
    }
  });

  test("cancellation rolls back all changes if the refund snapshot violates a database constraint", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    await webhook(payment.paymentCode);
    await db
      .update(bookings)
      .set({ rentalFeeAmount: "3000001", depositAmount: "-1" })
      .where(eq(bookings.id, booking.id));
    const [before] = await db.select().from(payments).where(eq(payments.id, payment.paymentId));
    const response = await app.inject({
      method: "POST",
      url: `/api/bookings/${booking.id}/cancel`,
      headers: { cookie: customerCookie },
    });
    expect(response.statusCode).toBe(500);
    expect((await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0]).toEqual(
      before,
    );
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0].status).toBe(
      "CONFIRMED",
    );
    expect(
      (
        await db
          .select()
          .from(capacityAllocations)
          .where(eq(capacityAllocations.referenceId, booking.id))
      )[0].status,
    ).toBe("ACTIVE");
  });

  test("authorized status verifies SePay without IPN and confirms once under concurrent polling", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    // Even when creation and the first claim land on the exact same timestamp,
    // only one instance may call the provider.
    const now = new Date();
    setSystemTime(now);
    await db
      .update(payments)
      .set({ createdAt: now, updatedAt: now })
      .where(eq(payments.id, payment.paymentId));
    providerOrders.set(payment.paymentCode, capturedOrder(payment.paymentCode));
    const read = () =>
      app.inject({
        method: "GET",
        url: `/api/payments/${payment.paymentId}/status`,
        headers: { cookie: customerCookie },
      });
    await Promise.all([read(), read(), read()]);
    const response = await read();
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      status: "SUCCEEDED",
      confirmation: { bookingId: booking.id },
    });
    expect(providerRequests).toEqual([payment.paymentCode]);
    const [saved] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(saved.status).toBe("CONFIRMED");
    expect(saved.qrTokenHash).toBeTruthy();
    const allocations = await db
      .select()
      .from(capacityAllocations)
      .where(eq(capacityAllocations.referenceId, booking.id));
    expect(allocations).toHaveLength(1);
    expect(allocations[0]).toMatchObject({ kind: "BOOKING", status: "ACTIVE", expiresAt: null });
    await dispatchFixtureMail();
    if (mailQueue) expect(await mailQueue.getJob(mailJobId(booking.id))).toBeTruthy();
    await webhook(payment.paymentCode);
    expect((await read()).json().data.confirmation.bookingCode).toBe(
      response.json().data.confirmation.bookingCode,
    );
    if (mailQueue)
      expect(
        await mailQueue.getJobs(["wait", "active", "delayed", "completed", "failed"]),
      ).toHaveLength(1);
  });

  test("unauthorized status never calls SePay or finalizes payment", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    providerOrders.set(payment.paymentCode, capturedOrder(payment.paymentCode));
    for (const headers of [
      {},
      { "x-booking-access-token": "a".repeat(64) },
      { cookie: otherCustomerCookie },
    ]) {
      const response = await app.inject({
        method: "GET",
        url: `/api/payments/${payment.paymentId}/status`,
        headers,
      });
      expect([401, 404]).toContain(response.statusCode);
    }
    expect(providerRequests).toEqual([]);
    expect(
      (await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0].status,
    ).toBe("PENDING");
  });

  test.each(["AUTHENTICATION_NOT_NEEDED", "CANCELLED"])(
    "provider order %s does not imply successful payment",
    async (order_status) => {
      const booking = await draft();
      const payment = (await pay(booking)).json().data;
      providerOrders.set(payment.paymentCode, capturedOrder(payment.paymentCode, { order_status }));
      const read = () =>
        app.inject({
          method: "GET",
          url: `/api/payments/${payment.paymentId}/status`,
          headers: { cookie: customerCookie },
        });
      expect((await read()).json().data.status).toBe("PENDING");
      expect((await read()).json().data.confirmation).toBeUndefined();
      expect(providerRequests).toHaveLength(1);
    },
  );

  test.each([
    { order_invoice_number: "another-invoice" },
    { order_amount: "1.00" },
    { order_currency: "USD" },
    { order_amount: "3000000.5" },
    { order_id: "" },
  ])(
    "rejects mismatched or invalid provider order %j without persisting success",
    async (overrides) => {
      const booking = await draft();
      const payment = (await pay(booking)).json().data;
      providerOrders.set(payment.paymentCode, capturedOrder(payment.paymentCode, overrides));
      const response = await app.inject({
        method: "GET",
        url: `/api/payments/${payment.paymentId}/status`,
        headers: { cookie: customerCookie },
      });
      expect(response.statusCode).toBe(503);
      expect(
        (await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0].status,
      ).toBe("PENDING");
      expect(
        (await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0].qrTokenHash,
      ).toBeNull();
    },
  );

  test("retries a reset SePay connection within the same reconciliation request", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    providerOrders.set(payment.paymentCode, [
      new TypeError("fetch failed", {
        cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }),
      }),
      capturedOrder(payment.paymentCode),
    ]);
    const response = await app.inject({
      method: "GET",
      url: `/api/payments/${payment.paymentId}/status`,
      headers: { cookie: customerCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      status: "SUCCEEDED",
      confirmation: { bookingId: booking.id },
    });
    expect(providerRequests).toEqual([payment.paymentCode, payment.paymentCode]);
  });

  test("repeated connection resets stay pending and return a retryable error", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    const reset = () =>
      new TypeError("fetch failed", {
        cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }),
      });
    providerOrders.set(payment.paymentCode, [reset(), reset()]);
    const response = await app.inject({
      method: "GET",
      url: `/api/payments/${payment.paymentId}/status`,
      headers: { cookie: customerCookie },
    });
    expect(response.statusCode).toBe(503);
    expect(providerRequests).toHaveLength(2);
    expect(
      (await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0].status,
    ).toBe("PENDING");
  });

  test("provider outage remains retryable and missing orders remain pending", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    const read = () =>
      app.inject({
        method: "GET",
        url: `/api/payments/${payment.paymentId}/status`,
        headers: { cookie: customerCookie },
      });
    expect((await read()).json().data.status).toBe("PENDING");
    setSystemTime(new Date(Date.now() + 16_000));
    providerOrders.set(payment.paymentCode, new DOMException("Timed out", "TimeoutError"));
    expect((await read()).statusCode).toBe(503);
    setSystemTime(new Date(Date.now() + 16_000));
    providerOrders.set(payment.paymentCode, capturedOrder(payment.paymentCode));
    expect((await read()).json().data.status).toBe("SUCCEEDED");
  });

  test.each([true, false])(
    "background reconciliation works after closing the tab and expired hold (capacity=%s)",
    async (available) => {
      const booking = await draft();
      const payment = (await pay(booking)).json().data;
      await db
        .update(capacityAllocations)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(capacityAllocations.referenceId, booking.id));
      if (!available)
        await db
          .update(storageUnits)
          .set({ status: "MAINTENANCE" })
          .where(eq(storageUnits.id, ids.unit));
      providerOrders.set(payment.paymentCode, capturedOrder(payment.paymentCode));
      const scheduled = Fastify();
      scheduled.register(
        fp(
          async (server) => {
            server.decorate("db", db);
            if (redis && mailQueue) {
              server.decorate("redis", redis);
              server.decorate("mailQueue", mailQueue);
            }
          },
          { name: "database-plugin" },
        ),
      );
      scheduled.register(cronPlugin, { facilityId: ids.facility });
      try {
        await scheduled.ready();
        const [saved] = await db.select().from(payments).where(eq(payments.id, payment.paymentId));
        expect(saved.status).toBe(available ? "SUCCEEDED" : "REFUND_PENDING");
        if (!available) expect(saved.refundAmount).toBe("3000000.00");
        expect(providerRequests).toEqual([payment.paymentCode]);
      } finally {
        await scheduled.close();
      }
    },
  );

  test("client-controlled sandbox finalizer is unavailable", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/payments/${payment.paymentId}/confirm-sandbox`,
        })
      ).statusCode,
    ).toBe(404);
  });

  test("starts SePay checkout on the same draft with snapshotted price, contact and a ten-minute hold", async () => {
    const booking = await draft();
    await db.update(bookings).set({ userId: ids.user }).where(eq(bookings.id, booking.id));
    const reservationsBefore = await db.select().from(reservationDrafts);
    await db.update(unitTypes).set({ monthlyPrice: 2000000 }).where(eq(unitTypes.id, ids.type));
    const start = Date.now();
    const response = await pay(booking, "x".repeat(128), {
      totalAmount: "1",
      userId: randomUUID(),
      status: "SUCCEEDED",
    });
    expect(response.statusCode).toBe(201);
    const data = response.json().data;
    expect(data).toMatchObject({ bookingId: booking.id, status: "PENDING", provider: "sepay" });
    expect(data.checkoutUrl).toStartWith("https://");
    expect(Number(data.checkoutFormFields.order_amount)).toBe(3000000);
    for (const [field, status] of [
      ["success_url", "success"],
      ["error_url", "error"],
      ["cancel_url", "cancel"],
    ]) {
      const url = new URL(data.checkoutFormFields[field]);
      expect(url.pathname).toBe("/bookings/payment-result");
      expect(url.searchParams.get("bookingId")).toBe(booking.id);
      expect(url.searchParams.get("paymentId")).toBe(data.paymentId);
      expect(url.searchParams.get("status")).toBe(status);
      expect(url.searchParams.has("draftId")).toBe(false);
    }
    expect(data.holdTokenHash).toBeUndefined();
    expect(data.draftAccessToken).toBeUndefined();
    const [payment] = await db.select().from(payments).where(eq(payments.id, data.paymentId));
    expect(payment).toMatchObject({
      bookingId: booking.id,
      draftId: null,
      status: "PENDING",
      paidAt: null,
      totalAmount: "3000000.00",
      currency: "VND",
    });
    const [saved] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(saved).toMatchObject({
      status: "DRAFT",
      userId: ids.user,
      bookingCode: null,
      qrTokenHash: null,

      contactPhone: contact.phone,
    });
    const holds = await db
      .select()
      .from(capacityAllocations)
      .where(eq(capacityAllocations.referenceId, booking.id));
    expect(holds).toHaveLength(1);
    expect(holds[0]).toMatchObject({
      kind: "HOLD",
      status: "ACTIVE",
      startsAt: new Date(booking.checkInAt),
      endsAt: new Date(booking.rentalEndAt),
      accessTokenHash: payment?.holdTokenHash,
    });
    expect(Date.parse(data.expiresAt)).toBeGreaterThanOrEqual(start + 600000);
    expect(Date.parse(data.expiresAt)).toBeLessThanOrEqual(Date.now() + 600000);
    expect(await db.select().from(reservationDrafts)).toEqual(reservationsBefore);
  });

  test("concurrent same-key retries reuse payment and hold without extending expiry", async () => {
    const booking = await draft();
    const key = randomUUID();
    const responses = await Promise.all(Array.from({ length: 4 }, () => pay(booking, key)));
    expect(responses.map((r) => r.statusCode)).toEqual([201, 201, 201, 201]);
    expect(new Set(responses.map((r) => r.json().data.paymentId)).size).toBe(1);
    expect(new Set(responses.map((r) => r.json().data.expiresAt)).size).toBe(1);
    const rows = await db
      .select()
      .from(capacityAllocations)
      .where(eq(capacityAllocations.referenceId, booking.id));
    expect(rows).toHaveLength(1);
    const shortened = new Date(Date.now() + 300000);
    await db
      .update(capacityAllocations)
      .set({ expiresAt: shortened })
      .where(eq(capacityAllocations.id, rows[0]?.id as string));
    const replay = await pay(booking, key);
    expect(replay.statusCode).toBe(201);
    expect(replay.json().data.expiresAt).toBe(shortened.toISOString());
    expect(await db.select().from(payments).where(eq(payments.bookingId, booking.id))).toHaveLength(
      1,
    );
  });

  test("payment status rebuilds only a booking checkout with an active hold", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    const response = await app.inject({
      method: "GET",
      url: `/api/payments/${payment.paymentId}/status`,
      headers: { cookie: customerCookie },
    });
    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.checkoutUrl).toBe(payment.checkoutUrl);
    expect(data.checkoutFormFields).toEqual(payment.checkoutFormFields);
    await db
      .update(capacityAllocations)
      .set({ expiresAt: new Date(0) })
      .where(eq(capacityAllocations.referenceId, booking.id));
    const expired = await app.inject({
      method: "GET",
      url: `/api/payments/${payment.paymentId}/status`,
      headers: { cookie: customerCookie },
    });
    expect(expired.statusCode).toBe(200);
    expect(expired.json().data.checkoutUrl).toBeUndefined();
    expect(expired.json().data.checkoutFormFields).toBeUndefined();
  });

  test("payment ID alone cannot expose checkout or booking confirmation", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    for (const paid of [false, true]) {
      if (paid) expect((await webhook(payment.paymentCode)).statusCode).toBe(200);
      const denied = await app.inject({
        method: "GET",
        url: `/api/payments/${payment.paymentId}/status`,
      });
      expect(denied.statusCode).toBe(401);
      expect(denied.headers["cache-control"]).toBe("no-store");
      expect(denied.json().data).toBeUndefined();
      expect(denied.body).not.toContain("qrToken");
      expect(denied.body).not.toContain("checkoutFormFields");
    }
  });

  test("old checkout tokens never authorize payment status", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    const response = await app.inject({
      method: "GET",
      url: `/api/payments/${payment.paymentId}/status`,
      headers: { "x-booking-access-token": "a".repeat(64) },
    });
    expect(response.statusCode).toBe(401);
  });

  test("only the saved booking owner can read payment through an account session", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    const request = (cookie: string) =>
      app.inject({
        method: "GET",
        url: `/api/payments/${payment.paymentId}/status`,
        headers: { cookie },
      });
    await db.update(bookings).set({ userId: ids.user }).where(eq(bookings.id, booking.id));
    expect((await request(customerCookie)).statusCode).toBe(200);
    expect((await request(adminCookie)).statusCode).toBe(403);
    await webhook(payment.paymentCode);
    const paid = await request(customerCookie);
    expect(paid.statusCode).toBe(200);
    expect(paid.json().data.confirmation.bookingId).toBe(booking.id);
    try {
      await db.update(users).set({ status: "INACTIVE" }).where(eq(users.id, ids.user));
      const disabled = await request(customerCookie);
      expect(disabled.statusCode).toBe(403);
      expect(disabled.headers["cache-control"]).toBe("no-store");
    } finally {
      await db.update(users).set({ status: "ACTIVE" }).where(eq(users.id, ids.user));
    }
  });

  test("checkout status stays readable through hold expiry and the manual refund lifecycle", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    const request = () =>
      app.inject({
        method: "GET",
        url: `/api/payments/${payment.paymentId}/status`,
        headers: { cookie: customerCookie },
      });
    await db
      .update(capacityAllocations)
      .set({ expiresAt: new Date(0) })
      .where(eq(capacityAllocations.referenceId, booking.id));
    expect((await request()).json().data.status).toBe("PENDING");
    await db
      .update(storageUnits)
      .set({ status: "MAINTENANCE" })
      .where(eq(storageUnits.id, ids.unit));
    expect((await webhook(payment.paymentCode)).statusCode).toBe(200);
    expect((await request()).json().data.status).toBe("REFUND_PENDING");
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/payments/${payment.paymentId}/refund/confirm`,
          headers: { cookie: adminCookie },
          payload: { reference: "manual-status-test" },
        })
      ).statusCode,
    ).toBe(200);
    const refunded = await request();
    expect(refunded.statusCode).toBe(200);
    expect(refunded.json().data.status).toBe("REFUNDED");
    expect(refunded.json().data.confirmation).toBeUndefined();
  });

  test("webhook confirms the existing booking and converts its hold atomically", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    expect((await webhook(payment.paymentCode)).statusCode).toBe(200);
    const [saved] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(saved?.status).toBe("CONFIRMED");
    expect(saved?.bookingCode).toStartWith("SX-");
    expect(saved?.qrTokenHash).toHaveLength(64);
    expect(saved?.contactPhone).toBe(contact.phone);
    const [paid] = await db.select().from(payments).where(eq(payments.id, payment.paymentId));
    expect(paid?.status).toBe("SUCCEEDED");
    expect(paid?.paidAt).toBeInstanceOf(Date);
    const allocations = await db
      .select()
      .from(capacityAllocations)
      .where(eq(capacityAllocations.referenceId, booking.id));
    expect(allocations).toHaveLength(1);
    expect(allocations[0]).toMatchObject({
      kind: "BOOKING",
      status: "ACTIVE",
      expiresAt: null,
      accessTokenHash: null,
    });
    expect(
      await db.select().from(unitAssignments).where(eq(unitAssignments.bookingId, booking.id)),
    ).toHaveLength(0);
    const events = await db
      .select()
      .from(paymentProviderEvents)
      .where(eq(paymentProviderEvents.paymentId, payment.paymentId));
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("PROCESSED");
  });

  test.each(["ACTIVE", "EXPIRED"] as const)(
    "late payment reclaims capacity from a %s expired hold without extending it",
    async (status) => {
      const booking = await draft();
      const payment = (await pay(booking)).json().data;
      await db
        .update(capacityAllocations)
        .set({ expiresAt: new Date(0), status })
        .where(eq(capacityAllocations.referenceId, booking.id));
      expect((await webhook(payment.paymentCode)).statusCode).toBe(200);
      expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0]?.status).toBe(
        "CONFIRMED",
      );
      const rows = await db
        .select()
        .from(capacityAllocations)
        .where(eq(capacityAllocations.referenceId, booking.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: "BOOKING", status: "ACTIVE", expiresAt: null });
    },
  );

  test("late payment with no capacity records a full manual refund and acknowledges retries", async () => {
    const booking = await draft();
    const other = await draft();
    const payment = (await pay(booking)).json().data;
    await db
      .update(capacityAllocations)
      .set({ expiresAt: new Date(0) })
      .where(eq(capacityAllocations.referenceId, booking.id));
    expect((await pay(other)).statusCode).toBe(201);
    const eventId = randomUUID();
    expect((await webhook(payment.paymentCode, {}, eventId)).statusCode).toBe(200);
    expect((await webhook(payment.paymentCode, {}, eventId)).statusCode).toBe(200);
    expect(
      (await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0],
    ).toMatchObject({
      status: "REFUND_PENDING",
      refundReason: "NO_CAPACITY",
      totalAmount: "3000000.00",
      refundReference: null,
      refundedAt: null,
    });
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0]).toMatchObject({
      status: "DRAFT",
      bookingCode: null,
      qrTokenHash: null,
    });
    expect(
      (
        await db
          .select()
          .from(capacityAllocations)
          .where(eq(capacityAllocations.referenceId, booking.id))
      )[0]?.status,
    ).toBe("RELEASED");
    const statusResponse = await app.inject({
      method: "GET",
      url: `/api/payments/${payment.paymentId}/status`,
      headers: { cookie: customerCookie },
    });
    expect(statusResponse.json().data.status).toBe("REFUND_PENDING");
    expect(statusResponse.json().data.confirmation).toBeUndefined();
    expect((await pay(booking)).statusCode).toBe(409);
  });

  test("late payment cannot confirm a facility that is no longer active", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    await db
      .update(capacityAllocations)
      .set({ expiresAt: new Date(0) })
      .where(eq(capacityAllocations.referenceId, booking.id));
    await db.update(facilities).set({ isActive: false }).where(eq(facilities.id, ids.facility));
    expect((await webhook(payment.paymentCode)).statusCode).toBe(200);
    expect(
      (await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0],
    ).toMatchObject({ status: "REFUND_PENDING", refundReason: "OFFERING_UNAVAILABLE" });
  });

  test.each([false, true])(
    "late payment after selected slot obeys the final slot cutoff (at cutoff: %s)",
    async (atCutoff) => {
      const booking = await draft();
      const payment = (await pay(booking)).json().data;
      await db
        .insert(checkInSlots)
        .values({ id: ids.lastSlot, name: "Last check-in", startTime: "17:00", endTime: "18:00" });
      await db
        .update(capacityAllocations)
        .set({ expiresAt: new Date(0) })
        .where(eq(capacityAllocations.referenceId, booking.id));
      setSystemTime(new Date(`${checkInDate}T${atCutoff ? "11:00:00" : "04:00:00"}.000Z`));
      expect((await webhook(payment.paymentCode)).statusCode).toBe(200);
      const [saved] = await db.select().from(payments).where(eq(payments.id, payment.paymentId));
      expect(saved?.status).toBe(atCutoff ? "REFUND_PENDING" : "SUCCEEDED");
      if (atCutoff) expect(saved?.refundReason).toBe("CHECK_IN_CLOSED");
    },
  );

  test("new drafts require tomorrow in Vietnam, not merely a future slot or 24 hours", async () => {
    setSystemTime(new Date("2030-01-01T17:01:00.000Z")); // Jan 2 00:01 in Vietnam.
    const payload = {
      facilityId: ids.facility,
      unitTypeId: ids.type,
      checkInSlotId: ids.slot,
      durationMonths: 2,
    };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/bookings/drafts",
          headers: { cookie: customerCookie },
          payload: { ...payload, checkInDate: "2030-01-02" },
        })
      ).statusCode,
    ).toBe(400);
    setSystemTime(new Date("2030-01-02T16:59:00.000Z")); // Jan 2 23:59 in Vietnam.
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/bookings/drafts",
          headers: { cookie: customerCookie },
          payload: { ...payload, checkInDate: "2030-01-03" },
        })
      ).statusCode,
    ).toBe(201);
  });

  test("a draft carried into check-in day cannot start a new payment", async () => {
    const booking = await draft();
    setSystemTime(new Date(`${checkInDate}T00:00:00.000Z`)); // 07:00, slot has not started.
    expect((await pay(booking)).statusCode).toBe(409);
    expect(await db.select().from(payments).where(eq(payments.bookingId, booking.id))).toHaveLength(
      0,
    );
  });

  test("admin completes a full manual refund with immutable audit; customer and guest are denied", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    await db
      .update(capacityAllocations)
      .set({ expiresAt: new Date(0) })
      .where(eq(capacityAllocations.referenceId, booking.id));
    await db
      .update(storageUnits)
      .set({ status: "MAINTENANCE" })
      .where(eq(storageUnits.id, ids.unit));
    expect((await webhook(payment.paymentCode)).statusCode).toBe(200);
    const url = `/api/payments/${payment.paymentId}/refund/confirm`;
    const payload = { reference: "bank-transfer-123", amount: 1, refundedBy: ids.user };
    expect((await app.inject({ method: "GET", url: "/api/payments/refunds" })).statusCode).toBe(
      401,
    );
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/payments/refunds",
          headers: { cookie: customerCookie },
        })
      ).statusCode,
    ).toBe(403);
    expect((await app.inject({ method: "POST", url, payload })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: "POST", url, payload, headers: { cookie: customerCookie } }))
        .statusCode,
    ).toBe(403);
    const list = await app.inject({
      method: "GET",
      url: "/api/payments/refunds",
      headers: { cookie: adminCookie },
    });
    expect(list.statusCode).toBe(200);
    expect(
      list.json().data.find((item: { paymentId: string }) => item.paymentId === payment.paymentId),
    ).toMatchObject({ amount: "3000000.00", reason: "NO_CAPACITY" });
    expect(
      (
        await app.inject({
          method: "POST",
          url,
          payload: { reference: "  " },
          headers: { cookie: adminCookie },
        })
      ).statusCode,
    ).toBe(400);
    const responses = await Promise.all(
      Array.from({ length: 2 }, () =>
        app.inject({ method: "POST", url, payload, headers: { cookie: adminCookie } }),
      ),
    );
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    expect(responses[0]?.json().data).toEqual(responses[1]?.json().data);
    expect(responses[0]?.json().data).toMatchObject({
      status: "REFUNDED",
      amount: "3000000.00",
      refundedBy: ids.admin,
      reference: payload.reference,
    });
    expect(
      (
        await app.inject({
          method: "POST",
          url,
          payload: { reference: "other-transfer" },
          headers: { cookie: adminCookie },
        })
      ).statusCode,
    ).toBe(409);
  });

  test.skipIf(!redisUrl)(
    "full API flow reserves the final unit once, queues one email, then manager assigns and staff checks in",
    async () => {
      const queue = mailQueue;
      if (!queue) throw new Error("Full flow requires REDIS_TEST_URL");
      const drafts = [await draft(), await draft()];
      const keys = [randomUUID(), randomUUID()];
      const starts = await Promise.all(drafts.map((booking, index) => pay(booking, keys[index])));
      expect(starts.map((response) => response.statusCode).sort()).toEqual([201, 409]);
      const index = starts.findIndex((response) => response.statusCode === 201);
      const booking = drafts[index];
      const first = starts[index]?.json().data;
      if (!booking || !first) throw new Error("Missing successful checkout");
      setSystemTime(new Date(Date.now() + 60000));
      const retry = await pay(booking, keys[index]);
      expect(retry.statusCode).toBe(201);
      expect(retry.json().data.paymentId).toBe(first.paymentId);
      expect(retry.json().data.expiresAt).toBe(first.expiresAt);
      const assignUnit = () =>
        app.inject({
          method: "POST",
          url: `/api/bookings/${booking.id}/assign-unit`,
          headers: { cookie: managerCookie },
          payload: { physicalUnitId: ids.unit },
        });
      expect((await assignUnit()).statusCode).toBe(404);
      const eventId = randomUUID();
      const delivered = await Promise.all(
        Array.from({ length: 4 }, () => webhook(first.paymentCode, {}, eventId)),
      );
      expect(delivered.map((response) => response.statusCode)).toEqual([200, 200, 200, 200]);
      const getStatus = () =>
        app.inject({
          method: "GET",
          url: `/api/payments/${first.paymentId}/status`,
          headers: { cookie: customerCookie },
        });
      const status = await getStatus();
      expect(status.statusCode).toBe(200);
      expect(status.json().data).toMatchObject({
        status: "SUCCEEDED",
        confirmation: { bookingId: booking.id, emailStatus: "PENDING" },
      });
      await dispatchFixtureMail();
      expect((await getStatus()).json().data.confirmation.emailStatus).toBe("QUEUED");
      const job = await queue.getJob(mailJobId(booking.id));
      expect(job).toBeDefined();
      expect(job?.data.deliveryId).toBe(booking.id);
      const queuedAt = job?.timestamp;
      expect((await webhook(first.paymentCode)).statusCode).toBe(200);
      expect(
        await queue.getJobCountByTypes("waiting", "delayed", "active", "completed", "failed"),
      ).toBe(1);
      expect((await queue.getJob(mailJobId(booking.id)))?.timestamp).toBe(queuedAt);
      const [hold] = await db
        .select()
        .from(capacityAllocations)
        .where(eq(capacityAllocations.referenceId, booking.id));
      expect(hold).toMatchObject({ kind: "BOOKING", status: "ACTIVE", expiresAt: null });
      const staff = await app.inject({
        method: "POST",
        url: `/api/bookings/${booking.id}/assign-staff`,
        headers: { cookie: managerCookie },
        payload: { staffId: ids.staff },
      });
      expect(staff.statusCode).toBe(200);
      const checkIn = () =>
        app.inject({
          method: "POST",
          url: `/api/check-ins/${booking.id}/confirm`,
          headers: { cookie: staffCookie },
        });
      expect((await checkIn()).statusCode).toBe(409);
      expect((await assignUnit()).statusCode).toBe(200);
      expect((await checkIn()).statusCode).toBe(409); // It is still before the booked day.
      setSystemTime(new Date(booking.checkInAt));
      const verified = await checkIn();
      expect(verified.statusCode).toBe(200);
      expect(verified.json().data.verification.status).toBe("VERIFIED");
      expect(
        await db
          .select()
          .from(checkInVerifications)
          .where(eq(checkInVerifications.bookingId, booking.id)),
      ).toHaveLength(1);
    },
  );

  test("the real expiry sweep releases capacity at the deadline and late webhook races a new checkout safely", async () => {
    const first = await draft();
    const second = await draft();
    const pending = (await pay(first)).json().data;
    setSystemTime(new Date(pending.expiresAt));
    const sweep = await expireCapacityHolds(db, new Date(), ids.facility);
    expect(sweep).toEqual({ expired: 1, skipped: false });
    expect(
      (
        await db
          .select()
          .from(capacityAllocations)
          .where(eq(capacityAllocations.referenceId, first.id))
      )[0]?.status,
    ).toBe("EXPIRED");
    expect((await pay(first)).statusCode).toBe(409);
    const [late, fresh] = await Promise.all([webhook(pending.paymentCode), pay(second)]);
    expect(late.statusCode).toBe(200);
    expect([201, 409]).toContain(fresh.statusCode);
    if (fresh.statusCode === 201) {
      expect((await webhook(fresh.json().data.paymentCode)).statusCode).toBe(200);
      expect(
        (await db.select().from(payments).where(eq(payments.id, pending.paymentId)))[0]?.status,
      ).toBe("REFUND_PENDING");
    } else {
      expect(
        (await db.select().from(payments).where(eq(payments.id, pending.paymentId)))[0]?.status,
      ).toBe("SUCCEEDED");
    }
    const allocations = await db
      .select()
      .from(capacityAllocations)
      .where(eq(capacityAllocations.facilityId, ids.facility));
    expect(allocations.filter((allocation) => allocation.status === "ACTIVE")).toHaveLength(1);
    expect(
      (await db.select().from(bookings).where(eq(bookings.facilityId, ids.facility))).filter(
        (booking) => booking.status === "CONFIRMED",
      ),
    ).toHaveLength(1);
    expect(await expireCapacityHolds(db, new Date(), ids.facility)).toEqual({
      expired: 0,
      skipped: false,
    });
  });

  test("after real hold expiry, late payment refunds in full and duplicate webhooks preserve the manual refund audit", async () => {
    const first = await draft();
    const second = await draft();
    const pending = (await pay(first)).json().data;
    setSystemTime(new Date(pending.expiresAt));
    expect((await expireCapacityHolds(db, new Date(), ids.facility)).expired).toBe(1);
    const next = await pay(second);
    expect(next.statusCode).toBe(201);
    expect((await webhook(next.json().data.paymentCode)).statusCode).toBe(200);
    const eventId = randomUUID();
    expect((await webhook(pending.paymentCode, {}, eventId)).statusCode).toBe(200);
    const getStatus = () =>
      app.inject({
        method: "GET",
        url: `/api/payments/${pending.paymentId}/status`,
        headers: { cookie: customerCookie },
      });
    expect((await getStatus()).json().data.status).toBe("REFUND_PENDING");
    const confirm = await app.inject({
      method: "POST",
      url: `/api/payments/${pending.paymentId}/refund/confirm`,
      headers: { cookie: adminCookie },
      payload: { reference: "full-flow-bank-transfer" },
    });
    expect(confirm.statusCode).toBe(200);
    const [refunded] = await db.select().from(payments).where(eq(payments.id, pending.paymentId));
    expect(refunded).toMatchObject({
      status: "REFUNDED",
      totalAmount: "3000000.00",
      refundReference: "full-flow-bank-transfer",
      refundedBy: ids.admin,
    });
    expect((await webhook(pending.paymentCode, {}, eventId)).statusCode).toBe(200);
    expect((await webhook(pending.paymentCode)).statusCode).toBe(200);
    expect((await db.select().from(payments).where(eq(payments.id, pending.paymentId)))[0]).toEqual(
      refunded,
    );
    expect((await getStatus()).json().data).toMatchObject({ status: "REFUNDED" });
    expect((await getStatus()).json().data.confirmation).toBeUndefined();
    expect(await mailQueue?.getJob(mailJobId(first.id))).toBeFalsy();
  });

  test("concurrent duplicate webhook deliveries finalize once", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    const eventId = randomUUID();
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => webhook(payment.paymentCode, {}, eventId)),
    );
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200, 200, 200]);
    const [saved] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    const initial = { bookingCode: saved?.bookingCode, qrTokenHash: saved?.qrTokenHash };
    expect((await webhook(payment.paymentCode)).statusCode).toBe(200);
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0]).toMatchObject(
      initial,
    );
    expect(
      await db
        .select()
        .from(capacityAllocations)
        .where(eq(capacityAllocations.referenceId, booking.id)),
    ).toHaveLength(1);
    const events = await db
      .select()
      .from(paymentProviderEvents)
      .where(eq(paymentProviderEvents.paymentId, payment.paymentId));
    expect(events.filter((event) => event.status === "PROCESSED")).toHaveLength(1);
  });

  test("webhook rolls back all writes on a database error and the same event can be retried", async () => {
    const booking = await draft();
    const other = await draft();
    const payment = (await pay(booking)).json().data;
    const eventId = randomUUID();
    const [collision] = await db
      .insert(payments)
      .values({
        bookingId: other.id,
        provider: "sepay",
        providerPaymentId: eventId,
        paymentCode: randomUUID().replaceAll("-", ""),
        holdTokenHash: "0".repeat(64),
        idempotencyKey: randomUUID(),
        totalAmount: "3000000",
        currency: "VND",
        status: "PENDING",
      })
      .returning();
    if (!collision) throw new Error("Missing collision fixture");
    expect((await webhook(payment.paymentCode, {}, eventId)).statusCode).toBe(500);
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0]).toMatchObject({
      status: "DRAFT",
      bookingCode: null,
      qrTokenHash: null,
    });
    expect(
      (await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0],
    ).toMatchObject({ status: "PENDING", paidAt: null });
    expect(
      (
        await db
          .select()
          .from(capacityAllocations)
          .where(eq(capacityAllocations.referenceId, booking.id))
      )[0]?.kind,
    ).toBe("HOLD");
    expect(
      await db
        .select()
        .from(paymentProviderEvents)
        .where(eq(paymentProviderEvents.providerEventId, eventId)),
    ).toHaveLength(0);
    await db.delete(payments).where(eq(payments.id, collision.id));
    expect((await webhook(payment.paymentCode, {}, eventId)).statusCode).toBe(200);
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0]?.status).toBe(
      "CONFIRMED",
    );
  });

  test("legacy bank webhooks are rejected without changing the pending payment", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    const payload = {
      id: randomUUID(),
      code: payment.paymentCode,
      transferAmount: 3000000,
      transferType: "in",
    };
    webhookEventIds.push(payload.id);
    for (const [headers, status] of [
      [{ authorization: "Apikey test-only-sepay-secret" }, 401],
      [{ "x-secret-key": "test-only-sepay-secret" }, 400],
    ] as const) {
      const response = await app.inject({
        method: "POST",
        url: "/api/payments/webhooks/sepay",
        headers,
        payload,
      });
      expect(response.statusCode).toBe(status);
    }
    expect(
      (await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0]?.status,
    ).toBe("PENDING");
    expect(
      await db
        .select()
        .from(paymentProviderEvents)
        .where(eq(paymentProviderEvents.providerEventId, payload.id)),
    ).toHaveLength(0);
    expect((await webhook(payment.paymentCode)).statusCode).toBe(200);
    expect(
      (await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0]?.status,
    ).toBe("SUCCEEDED");
  });

  test("webhook rejects invalid credentials before touching the booking", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    const response = await app.inject({
      method: "POST",
      url: "/api/payments/webhooks/sepay",
      headers: { "x-secret-key": "wrong-secret" },
      payload: { order: { order_invoice_number: payment.paymentCode } },
    });
    expect(response.statusCode).toBe(401);
    expect(
      (await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0]?.status,
    ).toBe("PENDING");
    expect(
      await db
        .select()
        .from(paymentProviderEvents)
        .where(eq(paymentProviderEvents.paymentId, payment.paymentId)),
    ).toHaveLength(0);
  });

  test("same-key checkout retry across Vietnam midnight preserves the original hold", async () => {
    const booking = await draft();
    const checkIn = new Date(booking.checkInAt);
    setSystemTime(new Date(checkIn.getTime() - 9 * 3600000 - 60000)); // Previous day 23:59.
    const key = randomUUID();
    const first = await pay(booking, key);
    expect(first.statusCode).toBe(201);
    setSystemTime(new Date(checkIn.getTime() - 9 * 3600000 + 60000)); // Check-in day 00:01.
    const replay = await pay(booking, key);
    expect(replay.statusCode).toBe(201);
    expect(replay.json().data.expiresAt).toBe(first.json().data.expiresAt);
  });

  test("two late payments competing for the last unit yield one booking and one manual refund", async () => {
    const first = await draft();
    const second = await draft();
    const a = (await pay(first)).json().data;
    await db
      .update(capacityAllocations)
      .set({ expiresAt: new Date(0) })
      .where(eq(capacityAllocations.referenceId, first.id));
    const b = (await pay(second)).json().data;
    await db
      .update(capacityAllocations)
      .set({ expiresAt: new Date(0) })
      .where(eq(capacityAllocations.referenceId, second.id));
    const responses = await Promise.all([webhook(a.paymentCode), webhook(b.paymentCode)]);
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    const rows = await db
      .select()
      .from(payments)
      .where(inArray(payments.id, [a.paymentId, b.paymentId]));
    expect(rows.map((row) => row.status).sort()).toEqual(["REFUND_PENDING", "SUCCEEDED"]);
  });

  test("a late-paid assigned booking can check in during a later slot on the same day", async () => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    await db
      .insert(checkInSlots)
      .values({ id: ids.lastSlot, name: "Last check-in", startTime: "17:00", endTime: "18:00" });
    await db
      .update(capacityAllocations)
      .set({ expiresAt: new Date(0) })
      .where(eq(capacityAllocations.referenceId, booking.id));
    setSystemTime(new Date(`${checkInDate}T09:00:00.000Z`)); // 16:00, beyond the old two-hour grace.
    expect((await webhook(payment.paymentCode)).statusCode).toBe(200);
    const request = () =>
      app.inject({
        method: "POST",
        url: `/api/check-ins/${booking.id}/confirm`,
        headers: { cookie: staffCookie },
      });
    await db
      .update(bookings)
      .set({ assignedStaffId: ids.staff })
      .where(eq(bookings.id, booking.id));
    expect((await request()).statusCode).toBe(409); // Payment alone is not sufficient.
    await db
      .insert(unitAssignments)
      .values({ bookingId: booking.id, physicalUnitId: ids.unit, assignedBy: ids.admin });
    expect((await request()).statusCode).toBe(200);
  });

  test.each([
    {
      transaction: {
        transaction_amount: "1",
        transaction_currency: "VND",
        transaction_status: "APPROVED",
        transaction_type: "PAYMENT",
      },
    },
    {
      transaction: {
        transaction_amount: "3000000",
        transaction_currency: "USD",
        transaction_status: "APPROVED",
        transaction_type: "PAYMENT",
      },
    },
    { notification_type: "TRANSACTION_VOID" },
    {
      transaction: {
        transaction_amount: "3000000",
        transaction_currency: "VND",
        transaction_status: "DECLINED",
        transaction_type: "PAYMENT",
      },
    },
  ])("does not confirm an invalid or non-payment event: %j", async (override) => {
    const booking = await draft();
    const payment = (await pay(booking)).json().data;
    const eventId = randomUUID();
    const transaction = override.transaction
      ? { ...override.transaction, transaction_id: eventId }
      : undefined;
    expect(
      (
        await webhook(
          payment.paymentCode,
          { ...override, ...(transaction ? { transaction } : {}) },
          eventId,
        )
      ).statusCode,
    ).toBe(200);
    expect((await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0]?.status).toBe(
      "DRAFT",
    );
    expect(
      (await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0]?.status,
    ).toBe("PENDING");
    expect(
      (
        await db
          .select()
          .from(paymentProviderEvents)
          .where(eq(paymentProviderEvents.providerEventId, eventId))
      )[0]?.status,
    ).toBe("IGNORED");
  });

  test("rejects another checkout reusing the idempotency key without persisting contact or hold", async () => {
    const first = await draft();
    const second = await draft();
    const key = randomUUID();
    expect((await pay(first, key)).statusCode).toBe(201);
    expect((await pay(second, key)).statusCode).toBe(409);
    expect(
      await db
        .select()
        .from(capacityAllocations)
        .where(eq(capacityAllocations.referenceId, second.id)),
    ).toHaveLength(0);
    expect(
      (await db.select().from(bookings).where(eq(bookings.id, second.id)))[0]?.contactPhone,
    ).toBeNull();
  });

  test("two drafts competing for the final unit produce one payment and one hold", async () => {
    const first = await draft();
    const second = await draft();
    const responses = await Promise.all([pay(first), pay(second)]);
    expect(responses.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(
      await db
        .select()
        .from(payments)
        .where(inArray(payments.bookingId, [first.id, second.id])),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(capacityAllocations)
        .where(eq(capacityAllocations.facilityId, ids.facility)),
    ).toHaveLength(1);
  });

  test("another role cannot start payment for a customer booking", async () => {
    const booking = await draft();
    const response = await app.inject({
      method: "POST",
      url: `/api/bookings/${booking.id}/pay`,
      headers: { cookie: adminCookie },
      payload: { idempotencyKey: randomUUID(), contactPhone: contact.phone },
    });
    expect(response.statusCode).toBe(403);
    expect(await db.select().from(payments).where(eq(payments.bookingId, booking.id))).toHaveLength(
      0,
    );
  });

  test("expired hold cannot be revived through retries or a new idempotency key", async () => {
    const booking = await draft();
    const key = randomUUID();
    expect((await pay(booking, key)).statusCode).toBe(201);
    await db
      .update(capacityAllocations)
      .set({ expiresAt: new Date(0) })
      .where(eq(capacityAllocations.referenceId, booking.id));
    expect((await pay(booking, key)).statusCode).toBe(409);
    expect((await pay(booking)).statusCode).toBe(409);
    expect(await db.select().from(payments).where(eq(payments.bookingId, booking.id))).toHaveLength(
      1,
    );
  });

  test("a different key cannot create a second pending payment for the booking", async () => {
    const booking = await draft();
    expect((await pay(booking)).statusCode).toBe(201);
    expect((await pay(booking)).statusCode).toBe(409);
    expect(await db.select().from(payments).where(eq(payments.bookingId, booking.id))).toHaveLength(
      1,
    );
  });

  test("same-key replay cannot overwrite the original checkout contact", async () => {
    const booking = await draft();
    const key = randomUUID();
    expect((await pay(booking, key)).statusCode).toBe(201);
    expect((await pay(booking, key, { contactPhone: "+84908765432" })).statusCode).toBe(409);
    expect(
      (await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0]?.contactPhone,
    ).toBe(contact.phone);
  });

  test("non-DRAFT bookings cannot start another checkout", async () => {
    const booking = await draft();
    await db
      .update(bookings)
      .set({
        status: "CONFIRMED",

        contactPhone: contact.phone,
      })
      .where(eq(bookings.id, booking.id));
    expect((await pay(booking)).statusCode).toBe(409);
    expect(await db.select().from(payments).where(eq(payments.bookingId, booking.id))).toHaveLength(
      0,
    );
  });

  test.each([
    "RESERVED",
    "OCCUPIED",
    "INSPECTION",
    "RETURN_PENDING",
    "INACTIVE",
    "LOCKED",
    "MAINTENANCE",
  ] as const)("revalidates inventory when the unit becomes %s after drafting", async (status) => {
    const booking = await draft();
    await db.update(storageUnits).set({ status }).where(eq(storageUnits.id, ids.unit));
    expect((await pay(booking)).statusCode).toBe(409);
    expect(
      await db
        .select()
        .from(capacityAllocations)
        .where(eq(capacityAllocations.referenceId, booking.id)),
    ).toHaveLength(0);
    expect(
      (await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0]?.contactPhone,
    ).toBeNull();
  });

  test.each([false, true])(
    "uses peak concurrent occupancy for sequential allocations (overlapping: %s)",
    async (overlapping) => {
      const booking = await draft();
      await db.insert(storageUnits).values({
        id: ids.extraUnit,
        code: ids.extraUnit,
        facilityId: ids.facility,
        unitTypeId: ids.type,
      });
      const start = new Date(booking.checkInAt);
      const end = new Date(booking.rentalEndAt);
      const middle = new Date((start.getTime() + end.getTime()) / 2);
      await db.insert(capacityAllocations).values([
        {
          facilityId: ids.facility,
          unitTypeId: ids.type,
          referenceId: randomUUID(),
          kind: "BOOKING",
          status: "ACTIVE",
          startsAt: start,
          endsAt: middle,
        },
        {
          facilityId: ids.facility,
          unitTypeId: ids.type,
          referenceId: randomUUID(),
          kind: "HOLD",
          status: "ACTIVE",
          startsAt: overlapping ? new Date(middle.getTime() - 1) : middle,
          endsAt: end,
          expiresAt: new Date(Date.now() + 600000),
        },
      ]);
      const draftResponse = await app.inject({
        method: "POST",
        url: "/api/bookings/drafts",
        headers: { cookie: customerCookie },
        payload: {
          facilityId: ids.facility,
          unitTypeId: ids.type,
          checkInSlotId: ids.slot,
          checkInDate,
          durationMonths: 2,
        },
      });
      expect(draftResponse.statusCode).toBe(overlapping ? 409 : 201);
      expect((await pay(booking)).statusCode).toBe(overlapping ? 409 : 201);
      expect(
        await db.select().from(payments).where(eq(payments.bookingId, booking.id)),
      ).toHaveLength(overlapping ? 0 : 1);
    },
  );

  test("ignores allocations outside the rental period and allocations no longer active", async () => {
    const booking = await draft();
    const start = new Date(booking.checkInAt);
    const end = new Date(booking.rentalEndAt);
    await db.insert(capacityAllocations).values([
      {
        facilityId: ids.facility,
        unitTypeId: ids.type,
        referenceId: randomUUID(),
        kind: "BOOKING",
        status: "ACTIVE",
        startsAt: new Date(start.getTime() - 86400000),
        endsAt: start,
      },
      {
        facilityId: ids.facility,
        unitTypeId: ids.type,
        referenceId: randomUUID(),
        kind: "BOOKING",
        status: "ACTIVE",
        startsAt: end,
        endsAt: new Date(end.getTime() + 86400000),
      },
      {
        facilityId: ids.facility,
        unitTypeId: ids.type,
        referenceId: randomUUID(),
        kind: "HOLD",
        status: "RELEASED",
        startsAt: start,
        endsAt: end,
      },
      {
        facilityId: ids.facility,
        unitTypeId: ids.type,
        referenceId: randomUUID(),
        kind: "HOLD",
        status: "EXPIRED",
        startsAt: start,
        endsAt: end,
      },
    ]);
    await draft();
    expect((await pay(booking)).statusCode).toBe(201);
  });

  test.each([false, true])(
    "requires one AVAILABLE unit for the full period when bookings are already assigned (same unit: %s)",
    async (sameUnit) => {
      await db.insert(storageUnits).values({
        id: ids.extraUnit,
        code: ids.extraUnit,
        facilityId: ids.facility,
        unitTypeId: ids.type,
      });
      const first = await draft();
      const second = await draft();
      const candidate = await draft();
      const start = new Date(first.checkInAt);
      const middle = new Date(start.getTime() + 30 * 86400000);
      const end = new Date(first.rentalEndAt);
      await db
        .update(bookings)
        .set({
          status: "CONFIRMED",

          contactPhone: contact.phone,
          rentalEndAt: middle,
        })
        .where(eq(bookings.id, first.id));
      await db
        .update(bookings)
        .set({
          status: "CONFIRMED",

          contactPhone: contact.phone,
          checkInDate: middle.toISOString().slice(0, 10),
        })
        .where(eq(bookings.id, second.id));
      await db.insert(unitAssignments).values([
        { bookingId: first.id, physicalUnitId: ids.unit, assignedBy: ids.user },
        {
          bookingId: second.id,
          physicalUnitId: sameUnit ? ids.unit : ids.extraUnit,
          assignedBy: ids.user,
        },
      ]);
      await db.insert(capacityAllocations).values([
        {
          facilityId: ids.facility,
          unitTypeId: ids.type,
          referenceId: first.id,
          kind: "BOOKING",
          status: "ACTIVE",
          startsAt: start,
          endsAt: middle,
        },
        {
          facilityId: ids.facility,
          unitTypeId: ids.type,
          referenceId: second.id,
          kind: "BOOKING",
          status: "ACTIVE",
          startsAt: middle,
          endsAt: end,
        },
      ]);
      const expected = sameUnit ? 201 : 409;
      if (sameUnit) await draft();
      else {
        const response = await app.inject({
          method: "POST",
          url: "/api/bookings/drafts",
          headers: { cookie: customerCookie },
          payload: {
            facilityId: ids.facility,
            unitTypeId: ids.type,
            checkInSlotId: ids.slot,
            checkInDate,
            durationMonths: 2,
          },
        });
        expect(response.statusCode).toBe(expected);
      }
      expect((await pay(candidate)).statusCode).toBe(expected);
    },
  );

  test("does not subtract an assigned RESERVED unit again from AVAILABLE inventory", async () => {
    await db.insert(storageUnits).values({
      id: ids.extraUnit,
      code: ids.extraUnit,
      facilityId: ids.facility,
      unitTypeId: ids.type,
    });
    const assigned = await draft();
    const candidate = await draft();
    await db
      .update(bookings)
      .set({
        status: "CONFIRMED",

        contactPhone: contact.phone,
      })
      .where(eq(bookings.id, assigned.id));
    await db.insert(unitAssignments).values({
      bookingId: assigned.id,
      physicalUnitId: ids.unit,
      assignedBy: ids.user,
    });
    await db.update(storageUnits).set({ status: "RESERVED" }).where(eq(storageUnits.id, ids.unit));
    await db.insert(capacityAllocations).values({
      facilityId: ids.facility,
      unitTypeId: ids.type,
      referenceId: assigned.id,
      kind: "BOOKING",
      status: "ACTIVE",
      startsAt: new Date(assigned.checkInAt),
      endsAt: new Date(assigned.rentalEndAt),
    });
    await draft();
    expect((await pay(candidate)).statusCode).toBe(201);
  });

  test("expired holds from another checkout do not consume capacity", async () => {
    const booking = await draft();
    await db.insert(capacityAllocations).values({
      facilityId: ids.facility,
      unitTypeId: ids.type,
      referenceId: randomUUID(),
      kind: "HOLD",
      status: "ACTIVE",
      startsAt: new Date(booking.checkInAt),
      endsAt: new Date(booking.rentalEndAt),
      expiresAt: new Date(0),
    });
    expect((await pay(booking)).statusCode).toBe(201);
  });

  test("missing SePay PG credentials return 503 without reserving capacity or saving contact", async () => {
    const booking = await draft();
    const merchant = env.SEPAY_MERCHANT_ID;
    const secret = env.SEPAY_SECRET_KEY;
    const unavailable = Fastify();
    try {
      env.SEPAY_MERCHANT_ID = undefined;
      env.SEPAY_SECRET_KEY = undefined;
      unavailable.decorate("db", db);
      unavailable.setValidatorCompiler(validatorCompiler);
      unavailable.setSerializerCompiler(serializerCompiler);
      setupErrorHandler(unavailable);
      await unavailable.register(bookingsRoutes, { prefix: "/api" });
      const response = await unavailable.inject({
        method: "POST",
        url: `/api/bookings/${booking.id}/pay`,
        headers: { cookie: customerCookie },
        payload: {
          contactPhone: contact.phone,
          idempotencyKey: randomUUID(),
        },
      });
      expect(response.statusCode).toBe(503);
      expect(
        await db
          .select()
          .from(capacityAllocations)
          .where(eq(capacityAllocations.referenceId, booking.id)),
      ).toHaveLength(0);
      expect(
        (await db.select().from(bookings).where(eq(bookings.id, booking.id)))[0]?.contactPhone,
      ).toBeNull();
    } finally {
      env.SEPAY_MERCHANT_ID = merchant;
      env.SEPAY_SECRET_KEY = secret;
      await unavailable.close();
    }
  });

  test.each([{ contactPhone: "invalid" }, { contactPhone: "" }, { idempotencyKey: "short" }])(
    "invalid input is rejected before persistence: %j",
    async (extra) => {
      const booking = await draft();
      expect((await pay(booking, randomUUID(), extra)).statusCode).toBe(400);
      expect(
        await db.select().from(payments).where(eq(payments.bookingId, booking.id)),
      ).toHaveLength(0);
    },
  );
});
