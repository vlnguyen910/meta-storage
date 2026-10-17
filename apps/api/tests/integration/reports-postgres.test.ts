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
  bookings,
  capacityAllocations,
  checkInSlots,
  db,
  eq,
  facilities,
  facilityAssignments,
  facilityUnitTypes,
  payments,
  rentals,
  reservationDrafts,
  storageUnits,
  unitTypes,
  users,
} from "@metastorage/database";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { auth } from "../../src/modules/auth/auth";
import { reportsRoutes } from "../../src/modules/reports/reports.routes";

const testUrl = process.env.REPORTS_TEST_DATABASE_URL;
describe.skipIf(!testUrl)("operator reports with isolated PostgreSQL", () => {
  const ids = {
    bom: randomUUID(),
    fm: randomUUID(),
    a: randomUUID(),
    b: randomUUID(),
    type: randomUUID(),
    slot: randomUUID(),
  };
  const app = Fastify();
  let session: ReturnType<typeof spyOn<typeof auth.api, "getSession">>;
  let created = false;
  let firstBookingId = "";
  let unitId = "";
  const period = "from=2026-10-01&to=2026-10-31";
  const get = (path: string) => app.inject({ method: "GET", url: `/api/reports/${path}` });
  const login = (role: string, id = ids.bom) =>
    session.mockResolvedValue({ user: { id, role, status: "ACTIVE" }, session: {} } as never);
  async function booking(status = "CONFIRMED", facilityId = ids.a) {
    const id = randomUUID();
    await db.insert(bookings).values({
      id,
      bookingCode: `REPORT-${id}`,
      contactName: "Report Customer",
      contactEmail: "reports@example.test",
      contactPhone: "0901234567",
      facilityId,
      unitTypeId: ids.type,
      requestedMonths: 3,
      checkInDate: "2026-10-01",
      checkInSlotId: ids.slot,
      rentalEndAt: new Date("2027-01-01"),
      monthlyRateSnapshot: "1000000",
      rentalFeeAmount: "3000000",
      depositAmount: "1000000",
      totalAmount: "4000000",
      status,
    });
    return id;
  }
  async function payment(
    bookingId: string | null,
    status: "SUCCEEDED" | "PENDING" | "FAILED" | "REFUND_PENDING" | "REFUNDED",
    paidAt: string | null,
    extra: Partial<typeof payments.$inferInsert> = {},
  ) {
    const id = randomUUID();
    await db.insert(payments).values({
      id,
      bookingId,
      holdTokenHash: id,
      provider: "TEST",
      paymentCode: id.slice(0, 30),
      providerPaymentId: id,
      idempotencyKey: id,
      totalAmount: "4000000",
      currency: "VND",
      status,
      paidAt: paidAt ? new Date(paidAt) : null,
      ...extra,
    });
    return id;
  }
  beforeAll(async () => {
    if (!testUrl || process.env.DATABASE_URL !== testUrl)
      throw new Error(
        "Use matching DATABASE_URL/REPORTS_TEST_DATABASE_URL for an isolated database",
      );
    if ((await db.select({ id: facilities.id }).from(facilities).limit(1)).length)
      throw new Error("Reports suite requires an empty dedicated test database");
    setSystemTime(new Date("2026-12-01T12:00:00Z"));
    await db.insert(users).values([
      {
        id: ids.bom,
        name: "Report BOM",
        email: `${ids.bom}@example.test`,
        role: "BUSINESS_OPERATION_MANAGER",
        status: "ACTIVE",
      },
      {
        id: ids.fm,
        name: "Report FM",
        email: `${ids.fm}@example.test`,
        role: "FACILITY_MANAGER",
        status: "ACTIVE",
      },
    ]);
    await db.insert(facilities).values([
      { id: ids.a, code: ids.a, name: "=SUM(1,2)", address: "Test A" },
      { id: ids.b, code: ids.b, name: "Zero-sales facility", address: "Test B" },
    ]);
    await db.insert(unitTypes).values({
      id: ids.type,
      code: ids.type,
      name: "Test storage",
      sizeLabel: "S",
      lengthM: 1,
      widthM: 1,
      heightM: 1,
      monthlyPrice: 9999999,
    });
    await db.insert(facilityUnitTypes).values({ facilityId: ids.a, unitTypeId: ids.type });
    await db
      .insert(checkInSlots)
      .values({ id: ids.slot, name: "Test slot", startTime: "09:00", endTime: "10:00" });
    await db
      .insert(facilityAssignments)
      .values({ facilityId: ids.a, userId: ids.fm, role: "FACILITY_MANAGER", isActive: true });
    const statuses = [
      "OCCUPIED",
      "OCCUPIED",
      "OCCUPIED",
      "OCCUPIED",
      "OCCUPIED",
      "OCCUPIED",
      "AVAILABLE",
      "AVAILABLE",
      "MAINTENANCE",
      "INACTIVE",
    ] as const;
    for (const status of statuses) {
      const id = randomUUID();
      if (!unitId) unitId = id;
      await db
        .insert(storageUnits)
        .values({ id, facilityId: ids.a, unitTypeId: ids.type, code: id, status });
    }
    const a = await booking();
    firstBookingId = a;
    await payment(a, "SUCCEEDED", "2026-10-10T10:00:00Z");
    await payment(a, "PENDING", null);
    await payment(a, "FAILED", null);
    await payment(await booking("CANCELLED"), "REFUND_PENDING", "2026-10-11T10:00:00Z", {
      refundAmount: "3000000",
      depositForfeitedAmount: "1000000",
      refundReason: "CUSTOMER_CANCELLATION",
    });
    await payment(await booking("CANCELLED"), "REFUNDED", "2026-10-12T10:00:00Z", {
      refundAmount: "3000000",
      depositForfeitedAmount: "1000000",
      refundedAt: new Date("2026-11-05T10:00:00Z"),
      refundReason: "NO_SHOW",
    });
    await payment(await booking("DRAFT"), "REFUND_PENDING", "2026-10-13T10:00:00Z", {
      refundAmount: "4000000",
      refundReason: "NO_CAPACITY",
    });
    await payment(await booking("DRAFT"), "REFUNDED", "2026-09-15T10:00:00Z", {
      refundAmount: "4000000",
      refundedAt: new Date("2026-10-06T10:00:00Z"),
      refundReason: "NO_CAPACITY",
    });
    await payment(await booking(), "SUCCEEDED", "2026-09-30T17:00:00Z");
    await payment(await booking(), "SUCCEEDED", "2026-09-30T16:59:59.999Z");
    await db.insert(rentals).values({
      bookingId: a,
      facilityId: ids.a,
      physicalUnitId: unitId,
      status: "ACTIVE",
      startAt: new Date("2026-10-01"),
      expectedEndAt: new Date("2027-01-01"),
      depositAmount: "1000000",
    });
    await db.insert(capacityAllocations).values([
      {
        facilityId: ids.a,
        unitTypeId: ids.type,
        referenceId: randomUUID(),
        kind: "HOLD",
        status: "ACTIVE",
        startsAt: new Date("2026-12-10"),
        endsAt: new Date("2027-01-10"),
        expiresAt: new Date("2026-12-01T13:00:00Z"),
      },
      {
        facilityId: ids.a,
        unitTypeId: ids.type,
        referenceId: randomUUID(),
        kind: "HOLD",
        status: "ACTIVE",
        startsAt: new Date("2026-12-10"),
        endsAt: new Date("2027-01-10"),
        expiresAt: new Date("2026-12-01T11:00:00Z"),
      },
    ]);
    created = true;
    session = spyOn(auth.api, "getSession");
    login("BUSINESS_OPERATION_MANAGER");
    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    await app.register(reportsRoutes, { prefix: "/api/reports" });
    await app.ready();
  });
  beforeEach(async () => {
    login("BUSINESS_OPERATION_MANAGER");
    await db
      .update(facilityAssignments)
      .set({ isActive: true, endedAt: null })
      .where(eq(facilityAssignments.userId, ids.fm));
  });
  afterAll(async () => {
    await app.close();
    session?.mockRestore();
    setSystemTime();
    if (!created) return;
    // This suite owns a dedicated empty database; no cleanup of application data.
  });
  test("reports receipts by paidAt, refunds by refundedAt, and retains refunded receipts", async () => {
    const response = await get(`revenue?${period}&limit=1`);
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    const data = response.json().data;
    expect(data.summary).toMatchObject({
      cashReceived: "20000000.00",
      rentalCollected: "15000000.00",
      depositCollected: "5000000.00",
      cashRefunded: "4000000.00",
      netCash: "16000000.00",
      depositHeld: "4000000.00",
      depositForfeited: "2000000.00",
      pendingRefundAmount: "7000000.00",
      pendingRefundCount: 2,
      paymentsReceivedCount: 5,
    });
    expect(data.items).toHaveLength(1);
    expect(data.total).toBe(2);
    const november = await get("revenue?from=2026-11-01&to=2026-11-30");
    expect(november.json().data.summary).toMatchObject({
      cashReceived: "0.00",
      rentalCollected: "0.00",
      cashRefunded: "3000000.00",
      netCash: "-3000000.00",
    });
  });
  test("shows physical utilization without counting holds as occupied units", async () => {
    const data = (await get("utilization")).json().data;
    expect(data.summary).toMatchObject({
      totalUnits: 10,
      activeUnits: 9,
      occupiedUnits: 6,
      availableUnits: 2,
      maintenanceUnits: 1,
      inactiveUnits: 1,
      utilizationPercent: 66.67,
      activeCheckoutHolds: 1,
    });
    expect(
      data.items.find((row: { facility: { id: string } }) => row.facility.id === ids.b).metrics
        .utilizationPercent,
    ).toBeNull();
  });
  test("overview directs BOM/SA to the existing manual refund queue and includes zero-sales facilities", async () => {
    login("SYSTEM_ADMIN");
    const data = (await get(`overview?${period}`)).json().data;
    expect(data.attention.refunds).toMatchObject({
      count: 2,
      amount: "7000000.00",
      canManage: true,
      endpoint: "/api/payments/refunds",
    });
    expect(data.attention.vacantCapacity.count).toBe(2);
    expect(data.attention.maintenance.count).toBe(1);
    expect(
      data.facilities.find((row: { facility: { id: string } }) => row.facility.id === ids.b)
        .financial.cashReceived,
    ).toBe("0.00");
  });
  test("enforces role and current facility assignments on JSON and CSV", async () => {
    session.mockResolvedValue(null);
    expect((await get("overview")).statusCode).toBe(401);
    for (const role of ["CUSTOMER", "FACILITY_STAFF"]) {
      login(role);
      expect((await get("revenue")).statusCode).toBe(403);
    }
    login("FACILITY_MANAGER", ids.fm);
    expect((await get(`overview?facilityId=${ids.b}`)).statusCode).toBe(403);
    expect((await get(`export?type=revenue&facilityId=${ids.b}`)).statusCode).toBe(403);
    const data = (await get(`overview?${period}`)).json().data;
    expect(data.total).toBe(1);
    expect(data.attention.refunds.canManage).toBe(false);
    expect(data.attention.refunds.endpoint).toBeNull();
    await db
      .update(facilityAssignments)
      .set({ endedAt: new Date("2026-11-30") })
      .where(eq(facilityAssignments.userId, ids.fm));
    expect((await get("overview")).statusCode).toBe(403);
  });
  test("exports all filtered rows using the same metrics and escapes spreadsheet formulas", async () => {
    const response = await get(`export?type=revenue&${period}`);
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.body).toContain('"\'=SUM(1,2)"');
    expect(response.body).toContain("Zero-sales facility");
    expect(response.body).toContain('"20000000.00"');
    const rentals = (await get("rentals?status=ACTIVE")).json().data;
    expect(rentals.total).toBe(1);
    expect(rentals.items[0].expectedEndAt).toBe("2027-01-01T00:00:00.000Z");
    expect(rentals.items[0]).not.toHaveProperty("contactEmail");
    expect((await get("export?type=rentals&status=ACTIVE")).body).toContain(rentals.items[0].id);
  });
  test("validates period/filter semantics and does not silently treat snapshots as historical", async () => {
    for (const query of [
      "revenue?from=2026-10-01",
      "revenue?from=2026-11-01&to=2026-10-01",
      "revenue?from=2026-02-30&to=2026-03-01",
      "utilization?from=2026-10-01",
      "export?type=utilization&from=2026-10-01&to=2026-10-31",
      "export?type=revenue&status=ACTIVE",
    ])
      expect((await get(query)).statusCode).toBe(400);
    expect(
      (await get(`revenue?${period}&unitTypeId=${randomUUID()}`)).json().data.summary.cashReceived,
    ).toBe("0.00");
  });
  test("flags an unclassifiable deposit instead of presenting a false balance", async () => {
    const id = await payment(firstBookingId, "REFUNDED", "2026-10-14T10:00:00Z", {
      refundAmount: "100",
      refundedAt: new Date("2026-11-01"),
    });
    try {
      const data = (await get(`revenue?${period}`)).json().data;
      expect(data.summary.depositHeld).toBeNull();
      expect(data.summary.unclassifiedDepositPayments).toBe(1);
      const cases = (await get("reconciliation")).json().data;
      expect(cases.total).toBe(1);
      expect(cases.items[0]).toMatchObject({
        paymentId: id,
        unclassifiedDeposit: true,
        missingSnapshot: false,
      });
    } finally {
      await db.delete(payments).where(eq(payments.id, id));
    }
  });
  test("does not mix currencies and reports their presence as a reconciliation issue", async () => {
    const id = await payment(firstBookingId, "SUCCEEDED", "2026-10-14T10:00:00Z", {
      currency: "USD",
      totalAmount: "10",
    });
    try {
      const data = (await get(`overview?${period}`)).json().data;
      expect(data.summary.financial.cashReceived).toBe("20000000.00");
      expect(data.attention.dataQuality).toMatchObject({
        hasIssues: true,
        unsupportedCurrencyPayments: 1,
      });
    } finally {
      await db.delete(payments).where(eq(payments.id, id));
    }
  });
  test("computes weighted utilization and totals before facility pagination", async () => {
    await db.insert(facilityUnitTypes).values({ facilityId: ids.b, unitTypeId: ids.type });
    const bid = await booking("CONFIRMED", ids.b);
    const pid = await payment(bid, "SUCCEEDED", "2026-10-20T10:00:00Z");
    const units = [randomUUID(), randomUUID()] as const;
    await db.insert(storageUnits).values([
      {
        id: units[0],
        code: units[0],
        facilityId: ids.b,
        unitTypeId: ids.type,
        status: "OCCUPIED",
      },
      {
        id: units[1],
        code: units[1],
        facilityId: ids.b,
        unitTypeId: ids.type,
        status: "AVAILABLE",
      },
    ]);
    try {
      const revenue = (await get(`revenue?${period}&limit=1`)).json().data;
      expect(revenue.items).toHaveLength(1);
      expect(revenue.summary.cashReceived).toBe("24000000.00");
      const utilization = (await get("utilization?limit=1")).json().data;
      expect(utilization.summary.utilizationPercent).toBe(63.64);
      login("FACILITY_MANAGER", ids.fm);
      expect((await get(`revenue?${period}`)).json().data.summary.cashReceived).toBe("20000000.00");
      expect((await get("export?type=utilization")).body).not.toContain("Zero-sales facility");
    } finally {
      await db.delete(payments).where(eq(payments.id, pid));
      await db.delete(bookings).where(eq(bookings.id, bid));
      for (const id of units) await db.delete(storageUnits).where(eq(storageUnits.id, id));
      await db.delete(facilityUnitTypes).where(eq(facilityUnitTypes.facilityId, ids.b));
    }
  });
  test("keeps received money visible when legacy data cannot be attributed to a booking", async () => {
    const draftId = randomUUID();
    await db.insert(reservationDrafts).values({
      id: draftId,
      facilityId: ids.a,
      unitTypeId: ids.type,
      checkInAt: new Date("2026-10-01"),
      rentalEndAt: new Date("2027-01-01"),
      durationMonths: 3,
      contactName: "Test",
      contactEmail: "test@example.test",
      contactPhone: "0901234567",
    });
    const id = await payment(null, "SUCCEEDED", "2026-10-14T10:00:00Z", { draftId });
    try {
      const data = (await get(`revenue?${period}`)).json().data;
      expect(data.summary.cashReceived).toBe("24000000.00");
      expect(data.summary.rentalCollected).toBeNull();
      expect(data.unattributed.cashReceived).toBe("4000000.00");
    } finally {
      await db.delete(payments).where(eq(payments.id, id));
      await db.delete(reservationDrafts).where(eq(reservationDrafts.id, draftId));
    }
  });
});
