import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  accounts,
  bookings,
  checkInSlots,
  db,
  eq,
  facilities,
  facilityAssignments,
  facilityUnitTypes,
  paymentProviderEvents,
  payments,
  rentalChargeEvents,
  rentalCharges,
  rentals,
  storageUnits,
  unitTypes,
  users,
} from "@metastorage/database";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { auth } from "../../src/modules/auth/auth";
import { authPlugin } from "../../src/modules/auth/auth.guard";
import { PaymentsRepository } from "../../src/modules/payments/payments.repository";
import { rentalChargesRoutes } from "../../src/modules/rental-charges/rental-charges.routes";
import { ReportsRepository } from "../../src/modules/reports/reports.repository";
import { ReportsService } from "../../src/modules/reports/reports.service";
import { assertTestDatabase } from "../fixtures/test-database";

const testUrl =
  process.env.RENTAL_CHARGES_TEST_DATABASE_URL ?? process.env.REPORTS_TEST_DATABASE_URL;

describe.skipIf(!testUrl)("rental charges with isolated PostgreSQL", () => {
  const ids = {
    customer: randomUUID(),
    otherCustomer: randomUUID(),
    staff: randomUUID(),
    manager: randomUUID(),
    facility: randomUUID(),
    unitType: randomUUID(),
    unit: randomUUID(),
    slot: randomUUID(),
  };
  const app = Fastify();
  let currentActor = { id: ids.customer, role: "CUSTOMER" };
  let session: ReturnType<typeof spyOn<typeof auth.api, "getSession">>;
  let bookingId = "";
  let rentalId = "";
  let chargeId = "";
  let rejectedChargeId = "";
  let paymentId = "";

  const login = (actor: typeof currentActor) => {
    currentActor = actor;
    session.mockResolvedValue({ user: { ...actor, status: "ACTIVE" }, session: {} } as never);
  };

  beforeAll(async () => {
    assertTestDatabase(testUrl, process.env);
    app.decorate("db", db);
    setupErrorHandler(app);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.register(authPlugin);
    app.register(rentalChargesRoutes, { prefix: "/api" });
    await app.ready();
    session = spyOn(auth.api, "getSession").mockImplementation(
      async () =>
        ({
          user: { ...currentActor, status: "ACTIVE" },
          session: {},
        }) as never,
    );

    await db.insert(users).values([
      {
        id: ids.customer,
        name: "Charge test customer",
        email: `${ids.customer}@example.test`,
        emailVerified: true,
        role: "CUSTOMER",
        status: "ACTIVE",
      },
      {
        id: ids.otherCustomer,
        name: "Other test customer",
        email: `${ids.otherCustomer}@example.test`,
        emailVerified: true,
        role: "CUSTOMER",
        status: "ACTIVE",
      },
      {
        id: ids.staff,
        name: "Charge test staff",
        email: `${ids.staff}@example.test`,
        emailVerified: true,
        role: "FACILITY_STAFF",
        status: "ACTIVE",
      },
      {
        id: ids.manager,
        name: "Charge test manager",
        email: `${ids.manager}@example.test`,
        emailVerified: true,
        role: "FACILITY_MANAGER",
        status: "ACTIVE",
      },
    ]);
    await db.insert(facilities).values({
      id: ids.facility,
      code: ids.facility,
      name: "Charge test facility",
      address: "Test",
    });
    await db.insert(unitTypes).values({
      id: ids.unitType,
      code: ids.unitType,
      name: "Charge test unit",
      sizeLabel: "S",
      lengthM: 1,
      widthM: 1,
      heightM: 1,
      monthlyPrice: 1000000,
    });
    await db
      .insert(facilityUnitTypes)
      .values({ facilityId: ids.facility, unitTypeId: ids.unitType });
    await db
      .insert(storageUnits)
      .values({ id: ids.unit, code: ids.unit, facilityId: ids.facility, unitTypeId: ids.unitType });
    await db.insert(checkInSlots).values({
      id: ids.slot,
      name: "Charge test slot",
      startTime: "09:00",
      endTime: "10:00",
    });
    await db.insert(facilityAssignments).values([
      { userId: ids.staff, facilityId: ids.facility, role: "FACILITY_STAFF", isActive: true },
      { userId: ids.manager, facilityId: ids.facility, role: "FACILITY_MANAGER", isActive: true },
    ]);
    const [booking] = await db
      .insert(bookings)
      .values({
        userId: ids.customer,
        facilityId: ids.facility,
        unitTypeId: ids.unitType,
        checkInSlotId: ids.slot,
        checkInDate: "2032-01-01",
        rentalEndAt: new Date("2032-02-01T03:00:00Z"),
        requestedMonths: 1,
        monthlyRateSnapshot: "1000000",
        rentalFeeAmount: "1000000",
        depositAmount: "1000000",
        totalAmount: "2000000",
        contactName: "Charge test customer",
        contactEmail: `${ids.customer}@example.test`,
        contactPhone: "0900000000",
        accessTokenHash: "charge-test-access-token-hash",
        status: "CHECKED_IN",
      })
      .returning({ id: bookings.id });
    if (!booking) throw new Error("Missing booking fixture");
    bookingId = booking.id;
    const [rental] = await db
      .insert(rentals)
      .values({
        bookingId,
        facilityId: ids.facility,
        physicalUnitId: ids.unit,
        status: "ACTIVE",
        startAt: new Date("2032-01-01T03:00:00Z"),
        expectedEndAt: new Date("2032-02-01T03:00:00Z"),
        depositAmount: "1000000",
      })
      .returning({ id: rentals.id });
    if (!rental) throw new Error("Missing rental fixture");
    rentalId = rental.id;
  });

  afterAll(async () => {
    session?.mockRestore();
    if (paymentId)
      await db.delete(paymentProviderEvents).where(eq(paymentProviderEvents.paymentId, paymentId));
    for (const id of [chargeId, rejectedChargeId].filter(Boolean)) {
      await db.delete(rentalChargeEvents).where(eq(rentalChargeEvents.chargeId, id));
      await db.delete(payments).where(eq(payments.rentalChargeId, id));
      await db.delete(rentalCharges).where(eq(rentalCharges.id, id));
    }
    if (rentalId) await db.delete(rentals).where(eq(rentals.id, rentalId));
    if (bookingId) await db.delete(bookings).where(eq(bookings.id, bookingId));
    await db.delete(facilityAssignments).where(eq(facilityAssignments.facilityId, ids.facility));
    await db.delete(storageUnits).where(eq(storageUnits.id, ids.unit));
    await db.delete(facilityUnitTypes).where(eq(facilityUnitTypes.facilityId, ids.facility));
    await db.delete(unitTypes).where(eq(unitTypes.id, ids.unitType));
    await db.delete(checkInSlots).where(eq(checkInSlots.id, ids.slot));
    await db.delete(facilities).where(eq(facilities.id, ids.facility));
    await db.delete(accounts).where(eq(accounts.userId, ids.customer));
    await db.delete(users).where(eq(users.id, ids.customer));
    await db.delete(users).where(eq(users.id, ids.otherCustomer));
    await db.delete(users).where(eq(users.id, ids.staff));
    await db.delete(users).where(eq(users.id, ids.manager));
    await app.close();
  });

  test("assigned staff submits, another manager approves, customer pays once without changing booking", async () => {
    login({ id: ids.staff, role: "FACILITY_STAFF" });
    const submitted = await app.inject({
      method: "POST",
      url: `/api/rentals/${rentalId}/charges`,
      payload: {
        category: "LOCK_REPLACEMENT",
        amount: 25000,
        evidence: "Lock replacement photo #fixture",
        dueDate: "2032-02-10",
      },
    });
    expect(submitted.statusCode).toBe(201);
    chargeId = submitted.json().data.id;

    login({ id: ids.manager, role: "FACILITY_MANAGER" });
    const approved = await app.inject({
      method: "POST",
      url: `/api/rental-charges/${chargeId}/decision`,
      payload: { decision: "APPROVE", reason: "Evidence checked" },
    });
    expect(approved.statusCode).toBe(200);

    login({ id: ids.staff, role: "FACILITY_STAFF" });
    const rejectedCharge = await app.inject({
      method: "POST",
      url: `/api/rentals/${rentalId}/charges`,
      payload: {
        category: "CLEANING",
        amount: 10000,
        evidence: "Duplicate charge fixture",
        dueDate: "2032-02-10",
      },
    });
    expect(rejectedCharge.statusCode).toBe(201);
    rejectedChargeId = rejectedCharge.json().data.id;
    login({ id: ids.manager, role: "FACILITY_MANAGER" });
    const rejected = await app.inject({
      method: "POST",
      url: `/api/rental-charges/${rejectedChargeId}/decision`,
      payload: { decision: "REJECT", reason: "Duplicate request" },
    });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json().data.status).toBe("VOID");

    const repository = new PaymentsRepository(db);
    const attempt = await repository.prepareRentalChargePayment({
      chargeId,
      userId: ids.customer,
      idempotencyKey: `charge-test-${randomUUID()}`,
      paymentCode: `STTEST${randomUUID().slice(0, 8)}`,
    });
    paymentId = attempt.payment.id;
    expect(attempt.payment.totalAmount).toBe("25000.00");
    const event = {
      providerEventId: `sepay-test-${randomUUID()}`,
      paymentCode: attempt.payment.paymentCode,
      amount: 25000,
      currency: "VND",
      transferType: "in" as const,
      successful: true,
      paidAt: new Date(Date.now() + 1000),
      referenceCode: "test-reference",
      metadata: { fixture: true },
    };
    const invalid = await repository.processRentalChargePaymentEvent({
      ...event,
      providerEventId: `sepay-test-invalid-${randomUUID()}`,
      currency: "USD",
    });
    expect(invalid?.processed).toBe(false);
    const result = await repository.processRentalChargePaymentEvent(event);
    expect(result?.processed).toBe(true);
    expect((await repository.processRentalChargePaymentEvent(event))?.duplicate).toBe(true);
    const [charge] = await db.select().from(rentalCharges).where(eq(rentalCharges.id, chargeId));
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    expect(charge?.status).toBe("PAID");
    expect(booking?.status).toBe("CHECKED_IN");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
      new Date(),
    );
    const reports = new ReportsService(new ReportsRepository(db));
    const report = await reports.revenue(
      { facilityId: ids.facility, from: today, to: today, limit: 20, offset: 0 },
      { id: ids.manager, role: "FACILITY_MANAGER" },
      true,
    );
    expect(report.summary.cashReceived).toBe("25000.00");
    expect(report.summary.extraChargeCollected).toBe("25000.00");
    const monthly = await reports.monthlyRevenue(
      { facilityId: ids.facility, from: today, to: today },
      { id: ids.manager, role: "FACILITY_MANAGER" },
    );
    expect(
      monthly.items.find((item) => item.month === today.slice(0, 7))?.extraChargeCollected,
    ).toBe("25000.00");
  });

  test("charge is visible only to its rental customer", async () => {
    login({ id: ids.customer, role: "CUSTOMER" });
    const own = await app.inject({ method: "GET", url: `/api/rentals/${rentalId}/charges` });
    expect(own.statusCode).toBe(200);
    expect(own.json().data[0].paidAmount).toBe("25000.00");
    login({ id: ids.otherCustomer, role: "CUSTOMER" });
    const foreign = await app.inject({ method: "GET", url: `/api/rentals/${rentalId}/charges` });
    expect(foreign.statusCode).toBe(404);
  });
});
