import { afterAll, afterEach, beforeAll, describe, expect, setSystemTime, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { SettleReturnSchema } from "@metastorage/contracts";
import type { RentalRenewalDto } from "@metastorage/contracts/renewals";
import {
  accounts,
  and,
  bookings,
  capacityAllocations,
  checkInSlots,
  db,
  eq,
  facilities,
  facilityAssignments,
  facilityOperatingHours,
  facilityReturnCalendars,
  inArray,
  notificationOutbox,
  paymentProviderEvents,
  payments,
  rentalChargeEvents,
  rentalChargeRefunds,
  rentalCharges,
  rentalRenewals,
  rentals,
  returnAudit,
  returnRequests,
  storageUnits,
  systemSettings,
  unitAssignments,
  unitTypes,
  users,
} from "@metastorage/database";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { OutboxRepository } from "../../../worker/src/notifications/outbox.repository";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { env } from "../../src/config/env";
import { auth } from "../../src/modules/auth/auth";
import { authPlugin } from "../../src/modules/auth/auth.guard";
import { authRoutes } from "../../src/modules/auth/auth.routes";
import { GuestRentalAccessRepository } from "../../src/modules/guest-rental-access/guest-rental-access.repository";
import { PaymentsRepository } from "../../src/modules/payments/payments.repository";
import type { VerifiedPaymentEvent } from "../../src/modules/payments/payments.types";
import { renewalsRoutes } from "../../src/modules/renewals/renewals.routes";
import { RentalChargesRepository } from "../../src/modules/rental-charges/rental-charges.repository";
import { rentalChargesRoutes } from "../../src/modules/rental-charges/rental-charges.routes";
import { RentalLifecycleRepository } from "../../src/modules/rentals/rental-lifecycle.repository";
import {
  RentalLifecycleService,
  recordImmediateExpiry,
} from "../../src/modules/rentals/rental-lifecycle.service";
import { rentalsRoutes } from "../../src/modules/rentals/rentals.routes";
import { ReportsRepository } from "../../src/modules/reports/reports.repository";
import { ReportsService } from "../../src/modules/reports/reports.service";
import { ReturnsRepository } from "../../src/modules/returns/returns.repository";
import { returnsRoutes } from "../../src/modules/returns/returns.routes";
import { createTestUnitType, deleteTestUnitTypes } from "../fixtures/facility-catalog";
import { assertTestDatabase } from "../fixtures/test-database";

const target =
  process.env.RENTAL_RENEWAL_TEST_DATABASE_URL ?? process.env.BOOKING_TEST_DATABASE_URL;
const now = new Date("2032-01-10T03:00:00Z");
const expiry = new Date("2032-01-31T03:00:00Z");

describe.skipIf(!target)("rental renewal with isolated PostgreSQL", () => {
  const app = Fastify({ logger: { level: "error" } });
  const ids = {
    owner: randomUUID(),
    other: randomUUID(),
    manager: randomUUID(),
    facility: randomUUID(),
    type: randomUUID(),
    slot: randomUUID(),
  };
  let cookie = "";
  let otherCookie = "";
  let managerCookie = "";
  let rentalId = "";
  let bookingId = "";
  const originalPaymentConfig = {
    PAYMENT_PROVIDER: env.PAYMENT_PROVIDER,
    SEPAY_MERCHANT_ID: env.SEPAY_MERCHANT_ID,
    SEPAY_SECRET_KEY: env.SEPAY_SECRET_KEY,
  };

  async function quoteFor(id: string, months = 1, key = randomUUID()): Promise<RentalRenewalDto> {
    const response = await app.inject({
      method: "POST",
      url: `/api/rentals/${id}/renewals`,
      headers: { cookie },
      payload: { months, idempotencyKey: key },
    });
    expect(response.statusCode).toBe(201);
    return response.json().data;
  }

  async function acceptedPayment(id: string, months = 1) {
    const quote = await quoteFor(id, months);
    const accept = await app.inject({
      method: "POST",
      url: `/api/rental-renewals/${quote.id}/accept`,
      headers: { cookie },
      payload: { acceptedTerms: true, termsVersion: quote.termsVersion },
    });
    expect(accept.statusCode).toBe(200);
    const chargeId = accept.json().data.chargeId as string;
    const response = await app.inject({
      method: "POST",
      url: `/api/rental-charges/${chargeId}/payments`,
      headers: { cookie },
      payload: { idempotencyKey: randomUUID() },
    });
    expect(response.statusCode).toBe(201);
    return { quote, chargeId, payment: response.json().data };
  }

  function success(paymentCode: string, amount = 1200000): VerifiedPaymentEvent {
    return {
      providerEventId: randomUUID(),
      paymentCode,
      amount,
      currency: "VND",
      transferType: "in",
      referenceCode: null,
      metadata: {},
      successful: true,
      paidAt: new Date(),
    };
  }

  const requestReturn = (id: string) =>
    app.inject({
      method: "POST",
      url: `/api/rentals/${id}/return-requests`,
      headers: { cookie },
      payload: { date: "2032-01-20", slotId: ids.slot, reason: "Return test" },
    });

  async function scenario(endAt = expiry) {
    const [unit] = await db
      .insert(storageUnits)
      .values({
        code: randomUUID(),
        facilityId: ids.facility,
        unitTypeId: ids.type,
        status: "OCCUPIED",
      })
      .returning();
    const [booking] = await db
      .insert(bookings)
      .values({
        userId: ids.owner,
        facilityId: ids.facility,
        unitTypeId: ids.type,
        checkInDate: "2032-01-01",
        checkInSlotId: ids.slot,
        rentalEndAt: endAt,
        requestedMonths: 1,
        monthlyRateSnapshot: "1000000",
        rentalFeeAmount: "1000000",
        depositAmount: "1000000",
        totalAmount: "2000000",
        status: "CHECKED_IN",
        contactName: "Renewal owner",
        contactEmail: `${ids.owner}@example.test`,
        contactPhone: "0900000000",
      })
      .returning();
    if (!unit || !booking) throw new Error("Missing fixture");
    const [rental] = await db
      .insert(rentals)
      .values({
        bookingId: booking.id,
        facilityId: ids.facility,
        physicalUnitId: unit.id,
        startAt: new Date("2032-01-01T03:00:00Z"),
        expectedEndAt: endAt,
        depositAmount: "1000000",
      })
      .returning();
    if (!rental) throw new Error("Missing rental fixture");
    await db
      .insert(unitAssignments)
      .values({ bookingId: booking.id, physicalUnitId: unit.id, assignedBy: ids.manager });
    await db.insert(capacityAllocations).values({
      facilityId: ids.facility,
      unitTypeId: ids.type,
      referenceId: booking.id,
      kind: "BOOKING",
      startsAt: rental.startAt,
      endsAt: endAt,
    });
    return { rentalId: rental.id, bookingId: booking.id, unitId: unit.id };
  }

  beforeAll(async () => {
    assertTestDatabase(target, process.env);
    setSystemTime(now);
    Object.assign(env, {
      PAYMENT_PROVIDER: "sepay",
      SEPAY_MERCHANT_ID: "renewal-test",
      SEPAY_SECRET_KEY: "renewal-test-secret",
    });
    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    await app.register(authPlugin);
    await app.register(authRoutes, { prefix: "/api/auth" });
    await app.register(rentalsRoutes, { prefix: "/api/rentals" });
    await app.register(renewalsRoutes, { prefix: "/api" });
    await app.register(rentalChargesRoutes, { prefix: "/api" });
    await app.register(returnsRoutes, { prefix: "/api" });
    await app.ready();
    const password = "Renewal-test-password-123";
    const context = await auth.$context;
    await db.insert(users).values({
      id: ids.owner,
      name: "Renewal owner",
      email: `${ids.owner}@example.test`,
      emailVerified: true,
      role: "CUSTOMER",
      status: "ACTIVE",
    });
    await db.insert(accounts).values({
      id: randomUUID(),
      userId: ids.owner,
      accountId: ids.owner,
      providerId: "credential",
      password: await context.password.hash(password),
    });
    for (const [id, role] of [
      [ids.other, "CUSTOMER"],
      [ids.manager, "FACILITY_MANAGER"],
    ] as const) {
      await db.insert(users).values({
        id,
        name: "Renewal test actor",
        email: `${id}@example.test`,
        emailVerified: true,
        role,
        status: "ACTIVE",
      });
      await db.insert(accounts).values({
        id: randomUUID(),
        userId: id,
        accountId: id,
        providerId: "credential",
        password: await context.password.hash(password),
      });
    }
    await db
      .insert(facilities)
      .values({ id: ids.facility, code: ids.facility, name: "Renewal facility", address: "Test" });
    await createTestUnitType(db, {
      facilityId: ids.facility,
      id: ids.type,
      code: ids.type,
      name: "Renewal type",
      sizeLabel: "S",
      lengthM: 1,
      widthM: 1,
      heightM: 1,
      monthlyPrice: 1200000,
    });

    await db
      .insert(checkInSlots)
      .values({ id: ids.slot, name: "Renewal slot", startTime: "10:00", endTime: "11:30" });
    await db.insert(facilityReturnCalendars).values({
      facilityId: ids.facility,
      timezone: "Asia/Ho_Chi_Minh",
      holidays: [],
      version: 1,
      updatedBy: ids.owner,
    });
    await db.insert(facilityOperatingHours).values(
      Array.from({ length: 7 }, (_, dayOfWeek) => ({
        facilityId: ids.facility,
        dayOfWeek,
        openTime: "08:00",
        closeTime: "18:00",
        timezone: "Asia/Ho_Chi_Minh",
      })),
    );
    await db
      .insert(facilityAssignments)
      .values({ facilityId: ids.facility, userId: ids.manager, role: "FACILITY_MANAGER" });
    await db
      .insert(systemSettings)
      .values([
        { key: "EXPIRY_REMINDER_DAYS", value: 7, description: "Test expiry cadence", version: 1 },
        {
          key: "ABANDONED_REVIEW_DAYS",
          value: 7,
          description: "Test abandoned cadence",
          version: 1,
        },
      ])
      .onConflictDoNothing();
    const initial = await scenario();
    rentalId = initial.rentalId;
    bookingId = initial.bookingId;
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email: `${ids.owner}@example.test`, password },
    });
    expect(login.statusCode).toBe(200);
    cookie = login.cookies.map((item) => `${item.name}=${item.value}`).join("; ");
    for (const [id, assign] of [
      [
        ids.other,
        (value: string) => {
          otherCookie = value;
        },
      ],
      [
        ids.manager,
        (value: string) => {
          managerCookie = value;
        },
      ],
    ] as const) {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        payload: { email: `${id}@example.test`, password },
      });
      expect(response.statusCode).toBe(200);
      assign(response.cookies.map((item) => `${item.name}=${item.value}`).join("; "));
    }
  });

  afterEach(() => setSystemTime(now));

  afterAll(async () => {
    setSystemTime();
    await app.close();
    Object.assign(env, originalPaymentConfig);
    const rentalIds = db
      .select({ id: rentals.id })
      .from(rentals)
      .where(eq(rentals.facilityId, ids.facility));
    const chargeIds = db
      .select({ id: rentalCharges.id })
      .from(rentalCharges)
      .where(inArray(rentalCharges.rentalId, rentalIds));
    const paymentIds = db
      .select({ id: payments.id })
      .from(payments)
      .where(inArray(payments.rentalChargeId, chargeIds));
    await db
      .delete(paymentProviderEvents)
      .where(inArray(paymentProviderEvents.paymentId, paymentIds));
    await db.delete(notificationOutbox).where(eq(notificationOutbox.facilityId, ids.facility));
    await db.delete(returnAudit).where(eq(returnAudit.facilityId, ids.facility));
    await db.delete(rentalRenewals).where(inArray(rentalRenewals.rentalId, rentalIds));
    await db.delete(rentalChargeEvents).where(inArray(rentalChargeEvents.chargeId, chargeIds));
    await db.delete(rentalChargeRefunds).where(inArray(rentalChargeRefunds.chargeId, chargeIds));
    await db.delete(payments).where(inArray(payments.id, paymentIds));
    await db.delete(rentalCharges).where(inArray(rentalCharges.id, chargeIds));
    await db.delete(capacityAllocations).where(eq(capacityAllocations.facilityId, ids.facility));
    await db.delete(returnRequests).where(eq(returnRequests.facilityId, ids.facility));
    await db.delete(rentals).where(eq(rentals.facilityId, ids.facility));
    const bookingIds = db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.facilityId, ids.facility));
    await db.delete(unitAssignments).where(inArray(unitAssignments.bookingId, bookingIds));
    await db.delete(bookings).where(eq(bookings.facilityId, ids.facility));
    await db.delete(storageUnits).where(eq(storageUnits.facilityId, ids.facility));
    await db
      .delete(facilityReturnCalendars)
      .where(eq(facilityReturnCalendars.facilityId, ids.facility));
    await db
      .delete(facilityOperatingHours)
      .where(eq(facilityOperatingHours.facilityId, ids.facility));
    await db.delete(facilityAssignments).where(eq(facilityAssignments.facilityId, ids.facility));
    await deleteTestUnitTypes(db, eq(unitTypes.id, ids.type));

    await db.delete(facilities).where(eq(facilities.id, ids.facility));
    await db.delete(checkInSlots).where(eq(checkInSlots.id, ids.slot));
    await db.delete(users).where(inArray(users.id, [ids.owner, ids.other, ids.manager]));
  });

  test("owner quotes rent only at the current rate for fixed 30-day months", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/rentals/${rentalId}/renewals`,
      headers: { cookie },
      payload: { months: 1, idempotencyKey: randomUUID() },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({
      oldEndAt: expiry.toISOString(),
      newEndAt: "2032-03-01T03:00:00.000Z",
      monthlyRate: "1200000",
      amount: "1200000",
      status: "QUOTED",
      chargeId: null,
    });
  });

  test("accepted quote caps payment expiry and verified replay applies the current term once", async () => {
    const quoted = await app.inject({
      method: "POST",
      url: `/api/rentals/${rentalId}/renewals`,
      headers: { cookie },
      payload: { months: 2, idempotencyKey: randomUUID() },
    });
    expect(quoted.statusCode).toBe(201);
    const quote = quoted.json().data;
    setSystemTime(new Date(now.getTime() + 2 * 60_000));
    const accepted = await app.inject({
      method: "POST",
      url: `/api/rental-renewals/${quote.id}/accept`,
      headers: { cookie },
      payload: { acceptedTerms: true, termsVersion: quote.termsVersion },
    });
    expect(accepted.statusCode).toBe(200);
    const chargeId = accepted.json().data.chargeId;
    const response = await app.inject({
      method: "POST",
      url: `/api/rental-charges/${chargeId}/payments`,
      headers: { cookie },
      payload: { idempotencyKey: randomUUID() },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().data.expiresAt).toBe(quote.expiresAt);
    const payment = response.json().data;
    const repository = new PaymentsRepository(db);
    const event = {
      providerEventId: randomUUID(),
      paymentCode: payment.paymentCode,
      amount: 2400000,
      currency: "VND",
      transferType: "in" as const,
      referenceCode: null,
      metadata: {},
      successful: true,
      paidAt: new Date(),
    };
    expect((await repository.processRentalChargePaymentEvent(event))?.processed).toBe(true);
    expect((await repository.processRentalChargePaymentEvent(event))?.duplicate).toBe(true);
    const [rental] = await db.select().from(rentals).where(eq(rentals.id, rentalId));
    expect(rental?.expectedEndAt.toISOString()).toBe(quote.newEndAt);
    expect(rental?.version).toBe(1);
    expect(rental?.depositAmount).toBe("1000000.00");
    const [original] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    expect(original?.rentalEndAt.toISOString()).toBe(expiry.toISOString());
    expect(original?.totalAmount).toBe("2000000.00");
    expect(
      (await db.select().from(rentalRenewals).where(eq(rentalRenewals.id, quote.id)))[0]?.status,
    ).toBe("APPLIED");
    const detail = await app.inject({
      method: "GET",
      url: `/api/rentals/${rentalId}`,
      headers: { cookie },
    });
    expect(detail.json().data.expectedEndAt).toBe(quote.newEndAt);
    const [guest] = await new GuestRentalAccessRepository(db).rental(bookingId);
    expect(guest?.rental.expectedEndAt.toISOString()).toBe(quote.newEndAt);
    const report = await new ReportsService(new ReportsRepository(db)).revenue(
      { facilityId: ids.facility, from: "2032-01-10", to: "2032-01-10", limit: 20, offset: 0 },
      { id: ids.manager, role: "FACILITY_MANAGER" },
      true,
    );
    expect(report.summary.renewalCollected).toBe("2400000.00");
    expect(report.summary.depositCollected).toBe("0.00");
  });

  test("authorization, strict input and ownership protect every renewal endpoint", async () => {
    const item = await scenario();
    const path = `/api/rentals/${item.rentalId}/renewals`;
    const body = { months: 1, idempotencyKey: randomUUID() };
    expect((await app.inject({ method: "POST", url: path, payload: body })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: path,
          headers: { cookie: otherCookie },
          payload: body,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "POST",
          url: path,
          headers: { cookie: managerCookie },
          payload: body,
        })
      ).statusCode,
    ).toBe(403);
    for (const payload of [
      { ...body, months: 0 },
      { ...body, months: 13 },
      { ...body, amount: 1 },
      { ...body, months: 1.5 },
    ])
      expect(
        (await app.inject({ method: "POST", url: path, headers: { cookie }, payload })).statusCode,
      ).toBe(400);
    const quote = await quoteFor(item.rentalId);
    for (const url of [path, `/api/rental-renewals/${quote.id}`])
      expect(
        (await app.inject({ method: "GET", url, headers: { cookie: otherCookie } })).statusCode,
      ).toBe(404);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/rental-renewals/${quote.id}/accept`,
          headers: { cookie: otherCookie },
          payload: { acceptedTerms: true, termsVersion: quote.termsVersion },
        })
      ).statusCode,
    ).toBe(404);
    expect(quote).not.toHaveProperty("customerId");
    expect(quote).not.toHaveProperty("idempotencyKey");
  });

  test("concurrent request and acceptance replay keep one quote and one immutable obligation", async () => {
    const item = await scenario();
    const key = randomUUID();
    const [first, second] = await Promise.all([
      quoteFor(item.rentalId, 1, key),
      quoteFor(item.rentalId, 1, key),
    ]);
    expect(first.id).toBe(second.id);
    const mismatch = await app.inject({
      method: "POST",
      url: `/api/rentals/${item.rentalId}/renewals`,
      headers: { cookie },
      payload: { months: 2, idempotencyKey: key },
    });
    expect(mismatch.statusCode).toBe(409);
    const path = `/api/rental-renewals/${first.id}/accept`;
    expect(
      (
        await app.inject({
          method: "POST",
          url: path,
          headers: { cookie },
          payload: { acceptedTerms: false, termsVersion: first.termsVersion },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: path,
          headers: { cookie },
          payload: { acceptedTerms: true, termsVersion: "obsolete" },
        })
      ).statusCode,
    ).toBe(409);
    await db.update(unitTypes).set({ monthlyPrice: 1500000 }).where(eq(unitTypes.id, ids.type));
    try {
      expect((await quoteFor(item.rentalId, 1, key)).monthlyRate).toBe("1200000");
      const accepted = await Promise.all(
        [1, 2].map(() =>
          app.inject({
            method: "POST",
            url: path,
            headers: { cookie },
            payload: { acceptedTerms: true, termsVersion: first.termsVersion },
          }),
        ),
      );
      expect(accepted.map((response) => response.statusCode)).toEqual([200, 200]);
      const chargeId = accepted[0]?.json().data.chargeId;
      expect(accepted[1]?.json().data.chargeId).toBe(chargeId);
      expect(
        await db.select().from(rentalCharges).where(eq(rentalCharges.rentalId, item.rentalId)),
      ).toHaveLength(1);
      expect(
        await new RentalChargesRepository(db).applyAdjustment(chargeId, {
          actorId: ids.manager,
          direction: "REDUCTION",
          amount: 1,
          reason: "Forbidden quote override",
        }),
      ).toEqual({ conflict: true });
      expect(
        (
          await app.inject({
            method: "POST",
            url: `/api/rental-charges/${chargeId}/dispute`,
            headers: { cookie },
            payload: { reason: "Forbidden quote override" },
          })
        ).statusCode,
      ).toBe(409);
    } finally {
      await db.update(unitTypes).set({ monthlyPrice: 1200000 }).where(eq(unitTypes.id, ids.type));
    }
  });

  test("facility-local six-day cutoff caps the quote, and expired quotes cannot be accepted", async () => {
    const item = await scenario(new Date("2032-01-16T03:00:00Z"));
    setSystemTime(new Date("2032-01-10T16:50:00Z"));
    const quote = await quoteFor(item.rentalId);
    expect(quote.cutoffAt).toBe("2032-01-10T16:59:59.999Z");
    expect(quote.expiresAt).toBe(quote.cutoffAt);
    setSystemTime(new Date("2032-01-10T17:00:00Z"));
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/rentals/${item.rentalId}/renewals`,
          headers: { cookie },
          payload: { months: 1, idempotencyKey: randomUUID() },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/rental-renewals/${quote.id}/accept`,
          headers: { cookie },
          payload: { acceptedTerms: true, termsVersion: quote.termsVersion },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/rental-renewals/${quote.id}`,
          headers: { cookie },
        })
      ).json().data.status,
    ).toBe("EXPIRED");
  });

  test.each([
    ["2032-02-29T03:00:00Z", "2032-03-30T03:00:00.000Z"],
    ["2033-02-28T03:00:00Z", "2033-03-30T03:00:00.000Z"],
    ["2032-07-31T03:00:00Z", "2032-08-30T03:00:00.000Z"],
  ])("fixed 30-day month from %s ends at %s", async (oldEnd, newEnd) => {
    const item = await scenario(new Date(oldEnd));
    expect((await quoteFor(item.rentalId)).newEndAt).toBe(newEnd);
  });

  test("OVERDUE, CLOSED and return-in-progress rentals cannot renew", async () => {
    for (const status of ["OVERDUE", "CLOSED", "RETURN_PENDING"]) {
      const item = await scenario();
      await db.update(rentals).set({ status }).where(eq(rentals.id, item.rentalId));
      expect(
        (
          await app.inject({
            method: "POST",
            url: `/api/rentals/${item.rentalId}/renewals`,
            headers: { cookie },
            payload: { months: 1, idempotencyKey: randomUUID() },
          })
        ).statusCode,
      ).toBe(409);
    }
  });

  test("unpaid return debt on another rental blocks quotes, while extra charges remain separate", async () => {
    const debtor = await scenario();
    const item = await scenario();
    const [charge] = await db
      .insert(rentalCharges)
      .values({
        rentalId: debtor.rentalId,
        source: "RETURN_DEBT",
        category: "RETURN_DEBT",
        amount: "50000",
        evidence: "Debt fixture",
        createdBy: ids.manager,
        status: "OPEN",
      })
      .returning();
    if (!charge) throw new Error("Missing debt");
    try {
      expect(
        (
          await app.inject({
            method: "POST",
            url: `/api/rentals/${item.rentalId}/renewals`,
            headers: { cookie },
            payload: { months: 1, idempotencyKey: randomUUID() },
          })
        ).statusCode,
      ).toBe(409);
      await db
        .update(rentalCharges)
        .set({ source: "EXTRA", category: "CLEANING" })
        .where(eq(rentalCharges.id, charge.id));
      expect((await quoteFor(item.rentalId)).status).toBe("QUOTED");
    } finally {
      await db.delete(rentalCharges).where(eq(rentalCharges.id, charge.id));
    }
  });

  test("verified debt collection clears the customer-wide renewal gate", async () => {
    const debtor = await scenario();
    const item = await scenario();
    const [charge] = await db
      .insert(rentalCharges)
      .values({
        rentalId: debtor.rentalId,
        source: "RETURN_DEBT",
        category: "RETURN_DEBT",
        amount: "50000",
        evidence: "Return debt",
        createdBy: ids.manager,
        status: "OPEN",
      })
      .returning();
    if (!charge) throw new Error("Missing debt fixture");
    try {
      const repo = new PaymentsRepository(db);
      const attempt = await repo.prepareRentalChargePayment({
        chargeId: charge.id,
        userId: ids.owner,
        idempotencyKey: randomUUID(),
        paymentCode: randomUUID().replaceAll("-", ""),
      });
      await repo.processRentalChargePaymentEvent(success(attempt.payment.paymentCode, 50000));
      expect((await quoteFor(item.rentalId)).status).toBe("QUOTED");
    } finally {
      await db.update(rentalCharges).set({ status: "VOID" }).where(eq(rentalCharges.id, charge.id));
    }
  });

  test("facility timezone snapshots handle DST while the added term remains exactly 720 hours", async () => {
    const item = await scenario(new Date("2032-02-29T15:00:00Z"));
    await db
      .update(facilityReturnCalendars)
      .set({ timezone: "America/New_York" })
      .where(eq(facilityReturnCalendars.facilityId, ids.facility));
    try {
      const quote = await quoteFor(item.rentalId);
      expect(quote.timezone).toBe("America/New_York");
      expect(quote.cutoffAt).toBe("2032-02-24T04:59:59.999Z");
      expect(quote.newEndAt).toBe("2032-03-30T15:00:00.000Z");
    } finally {
      await db
        .update(facilityReturnCalendars)
        .set({ timezone: "Asia/Ho_Chi_Minh" })
        .where(eq(facilityReturnCalendars.facilityId, ids.facility));
    }
  });

  test("failed, wrong-amount and wrong-currency events leave the term unchanged", async () => {
    const item = await scenario();
    const { payment } = await acceptedPayment(item.rentalId);
    const repo = new PaymentsRepository(db);
    for (const extra of [{ successful: false }, { amount: 1 }, { currency: "USD" }])
      expect(
        (await repo.processRentalChargePaymentEvent({ ...success(payment.paymentCode), ...extra }))
          ?.processed,
      ).toBe(false);
    expect((await db.select().from(rentals).where(eq(rentals.id, item.rentalId)))[0]?.version).toBe(
      0,
    );
    expect(
      (await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0]?.status,
    ).toBe("PENDING");
  });

  test("late capture creates one controlled refund and never extends the rental", async () => {
    const item = await scenario();
    const { quote, payment, chargeId } = await acceptedPayment(item.rentalId);
    setSystemTime(new Date(now.getTime() + 16 * 60_000));
    const event = success(payment.paymentCode);
    const repo = new PaymentsRepository(db);
    await repo.processRentalChargePaymentEvent(event);
    await repo.processRentalChargePaymentEvent(event);
    expect(
      (
        await db.select().from(rentals).where(eq(rentals.id, item.rentalId))
      )[0]?.expectedEndAt.toISOString(),
    ).toBe(quote.oldEndAt);
    expect(
      (await db.select().from(rentalRenewals).where(eq(rentalRenewals.id, quote.id)))[0]?.status,
    ).toBe("REFUND_REQUIRED");
    expect(
      await db.select().from(rentalChargeRefunds).where(eq(rentalChargeRefunds.chargeId, chargeId)),
    ).toHaveLength(1);
    expect(
      (await db.select().from(payments).where(eq(payments.id, payment.paymentId)))[0]?.status,
    ).toBe("REFUND_PENDING");
  });

  test("provider payment at the final cutoff millisecond is accepted", async () => {
    const item = await scenario(new Date("2032-01-16T03:00:00Z"));
    setSystemTime(new Date("2032-01-10T16:50:00Z"));
    const { quote, payment } = await acceptedPayment(item.rentalId);
    setSystemTime(new Date(quote.cutoffAt));
    await new PaymentsRepository(db).processRentalChargePaymentEvent(success(payment.paymentCode));
    expect(
      (await db.select().from(rentalRenewals).where(eq(rentalRenewals.id, quote.id)))[0]?.status,
    ).toBe("APPLIED");
  });

  test("on-time provider payment can apply when its callback arrives after quote expiry", async () => {
    const item = await scenario();
    const { quote, payment } = await acceptedPayment(item.rentalId);
    const event = success(payment.paymentCode);
    event.paidAt = new Date(now.getTime() + 10 * 60_000);
    setSystemTime(new Date(now.getTime() + 60 * 60_000));
    await new PaymentsRepository(db).processRentalChargePaymentEvent(event);
    expect(
      (
        await db.select().from(rentals).where(eq(rentals.id, item.rentalId))
      )[0]?.expectedEndAt.toISOString(),
    ).toBe(quote.newEndAt);
  });

  test("two paid renewals for the same version apply one term and refund the loser", async () => {
    const item = await scenario();
    const first = await acceptedPayment(item.rentalId);
    const second = await acceptedPayment(item.rentalId, 2);
    const repo = new PaymentsRepository(db);
    await Promise.all([
      repo.processRentalChargePaymentEvent(success(first.payment.paymentCode)),
      repo.processRentalChargePaymentEvent(success(second.payment.paymentCode, 2400000)),
    ]);
    const rows = await db
      .select()
      .from(rentalRenewals)
      .where(eq(rentalRenewals.rentalId, item.rentalId));
    expect(rows.filter((row) => row.status === "APPLIED")).toHaveLength(1);
    expect(rows.filter((row) => row.status === "REFUND_REQUIRED")).toHaveLength(1);
    expect((await db.select().from(rentals).where(eq(rentals.id, item.rentalId)))[0]?.version).toBe(
      1,
    );
    expect(
      (await db.select().from(storageUnits).where(eq(storageUnits.id, item.unitId)))[0]?.status,
    ).toBe("OCCUPIED");
  });

  test("return committed before payment prevents application; concurrent return uses the same lock", async () => {
    const first = await scenario();
    const pending = await acceptedPayment(first.rentalId);
    expect((await requestReturn(first.rentalId)).statusCode).toBe(201);
    await new PaymentsRepository(db).processRentalChargePaymentEvent(
      success(pending.payment.paymentCode),
    );
    expect(
      (await db.select().from(rentalRenewals).where(eq(rentalRenewals.id, pending.quote.id)))[0]
        ?.status,
    ).toBe("REFUND_REQUIRED");
    const second = await scenario();
    const racing = await acceptedPayment(second.rentalId);
    const results = await Promise.all([
      new PaymentsRepository(db).processRentalChargePaymentEvent(
        success(racing.payment.paymentCode),
      ),
      requestReturn(second.rentalId),
    ]);
    expect(results[1].statusCode).toBe(201);
    const [renewal] = await db
      .select()
      .from(rentalRenewals)
      .where(eq(rentalRenewals.id, racing.quote.id));
    const [rental] = await db.select().from(rentals).where(eq(rentals.id, second.rentalId));
    expect(rental?.version).toBe(renewal?.status === "APPLIED" ? 1 : 0);
    expect(rental?.status).toBe("RETURN_PENDING");
    expect(
      (await db.select().from(storageUnits).where(eq(storageUnits.id, second.unitId)))[0]?.status,
    ).toBe("OCCUPIED");
  });

  test("confirmed competing capacity wins over a quote that has no hold", async () => {
    const item = await scenario();
    const { quote, payment } = await acceptedPayment(item.rentalId);
    const [blocked] = await db
      .insert(capacityAllocations)
      .values({
        facilityId: ids.facility,
        unitTypeId: ids.type,
        referenceId: randomUUID(),
        kind: "BOOKING",
        startsAt: new Date(quote.oldEndAt),
        endsAt: new Date(quote.newEndAt),
      })
      .returning();
    if (!blocked) throw new Error("Missing capacity fixture");
    try {
      await new PaymentsRepository(db).processRentalChargePaymentEvent(
        success(payment.paymentCode),
      );
      expect(
        (await db.select().from(rentalRenewals).where(eq(rentalRenewals.id, quote.id)))[0]
          ?.failureReason,
      ).toBe("capacity");
      expect(
        (await db.select().from(rentals).where(eq(rentals.id, item.rentalId)))[0]?.version,
      ).toBe(0);
    } finally {
      await db.delete(capacityAllocations).where(eq(capacityAllocations.id, blocked.id));
    }
  });

  test("expiry sweep and delayed callback do not revive or release an expired rental", async () => {
    const item = await scenario();
    const { quote, payment } = await acceptedPayment(item.rentalId);
    const event = success(payment.paymentCode);
    setSystemTime(new Date(quote.oldEndAt));
    await Promise.all([
      new RentalLifecycleService(
        new RentalLifecycleRepository(db),
        new ReturnsRepository(db),
      ).sweep(new Date(), ids.facility),
      new PaymentsRepository(db).processRentalChargePaymentEvent(event),
    ]);
    const [rental] = await db.select().from(rentals).where(eq(rentals.id, item.rentalId));
    expect(rental?.status).toBe("OVERDUE");
    expect(rental?.version).toBe(0);
    expect(
      (await db.select().from(rentalRenewals).where(eq(rentalRenewals.id, quote.id)))[0]?.status,
    ).toBe("REFUND_REQUIRED");
    expect(
      (await db.select().from(storageUnits).where(eq(storageUnits.id, item.unitId)))[0]?.status,
    ).toBe("OCCUPIED");
  });

  test("renewal suppresses queued old-term reminders and schedules a deduplicated new term", async () => {
    const item = await scenario();
    const { quote, payment } = await acceptedPayment(item.rentalId);
    const [old] = await db
      .insert(notificationOutbox)
      .values({
        eventKey: `rental:${item.rentalId}:expiry`,
        recipientKey: "customer",
        eventType: "UPCOMING_EXPIRY",
        bookingId: item.bookingId,
        facilityId: ids.facility,
        recipientRole: "CUSTOMER",
        recipientEmail: `${ids.owner}@example.test`,
        subject: "Old term",
        body: "Old expiry",
        status: "ENQUEUED",
      })
      .returning();
    if (!old) throw new Error("Missing old reminder");
    await new PaymentsRepository(db).processRentalChargePaymentEvent(success(payment.paymentCode));
    expect(
      (await db.select().from(notificationOutbox).where(eq(notificationOutbox.id, old.id)))[0]
        ?.status,
    ).toBe("SUPPRESSED");
    const worker = new OutboxRepository(db);
    expect(await worker.authorized(old, now)).toBe(false);
    const reminderAt = new Date(Date.parse(quote.newEndAt) - 6 * 86400000);
    await db.transaction(async (tx) => {
      const [current] = await tx.select().from(rentals).where(eq(rentals.id, item.rentalId));
      if (!current) throw new Error("Missing rental");
      await recordImmediateExpiry(tx, current, reminderAt);
    });
    await new RentalLifecycleService(
      new RentalLifecycleRepository(db),
      new ReturnsRepository(db),
    ).sweep(reminderAt, ids.facility);
    const reminders = await db
      .select()
      .from(notificationOutbox)
      .where(
        and(
          eq(notificationOutbox.bookingId, item.bookingId),
          eq(notificationOutbox.eventKey, `rental:${item.rentalId}:term:1:expiry`),
        ),
      );
    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.rentalTermVersion).toBe(1);
    const reminder = reminders[0];
    if (!reminder) throw new Error("Missing new-term reminder");
    expect(await worker.authorized(reminder, reminderAt)).toBe(true);
    await db.update(rentals).set({ status: "RETURN_PENDING" }).where(eq(rentals.id, item.rentalId));
    expect(await worker.authorized(reminder, reminderAt)).toBe(true);
  });

  test("early return never authorizes a new unused-rent refund", () => {
    expect(
      SettleReturnSchema.safeParse({
        expectedVersion: 0,
        damageAmount: "0",
        unusedRentRefundAmount: "1",
        reason: "Early return",
      }).success,
    ).toBe(false);
    expect(
      SettleReturnSchema.safeParse({
        expectedVersion: 0,
        damageAmount: "0",
        unusedRentRefundAmount: "0",
        reason: "Deposit settlement",
      }).success,
    ).toBe(true);
  });
});
