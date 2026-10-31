import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  setSystemTime,
  spyOn,
  test,
} from "bun:test";
import { randomUUID } from "node:crypto";
import {
  FacilityTaskReferenceType,
  FacilityTaskStatus,
  FacilityTaskType,
  HANDOVER_CHECKLIST_ITEMS,
} from "@metastorage/contracts";
import {
  and,
  appointments,
  bookings,
  capacityAllocations,
  checkInSlots,
  db,
  debts,
  eq,
  facilities,
  facilityAssignments,
  facilityTasks,
  inArray,
  inspections,
  isNull,
  notificationOutbox,
  or,
  PaymentType,
  paymentProviderEvents,
  payments,
  policyViolationFees,
  RentalStatus,
  rentals,
  reservations,
  returnSettlements,
  storageUnits,
  supportTickets,
  systemSettings,
  unitAssignments,
  unitTypes,
  users,
} from "@metastorage/database";
import {
  APPOINTMENT_STATUSES as Status,
  APPOINTMENT_TYPES as Type,
} from "@metastorage/database/schema/appointments";
import { ReservationStatus } from "@metastorage/database/schema/reservations";
import { UserRole } from "@metastorage/database/schema/user-enums";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { migrateBookingsToReservations } from "../../../../packages/database/src/migrate-bookings-to-reservations";
import { localDate } from "../../src/common/date";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { env } from "../../src/config/env";
import { appointmentsRoutes } from "../../src/modules/appointments/appointments.routes";
import { createAppointmentsService } from "../../src/modules/appointments/appointments.service";
import { auth } from "../../src/modules/auth/auth";
import { FacilityAssignmentsRepository } from "../../src/modules/facilities/facility-assignments.repository";
import { createFacilityTasksService } from "../../src/modules/facility-tasks/facility-tasks.service";
import { inspectionsRoutes } from "../../src/modules/inspections/inspections.routes";
import { PaymentsRepository } from "../../src/modules/payments/payments.repository";
import { paymentsRoutes } from "../../src/modules/payments/payments.routes";
import { PaymentsService } from "../../src/modules/payments/payments.service";
import type {
  SepayCreateCheckoutInput,
  VerifiedPaymentEvent,
} from "../../src/modules/payments/payments.types";
import { createReservationPaymentsService } from "../../src/modules/payments/reservation-payments.service";
import { SepayPaymentGateway } from "../../src/modules/payments/sepay.gateway";
import { ReportsRepository } from "../../src/modules/reports/reports.repository";
import { reservationsRoutes } from "../../src/modules/reservations/reservations.routes";
import { createReservationsService } from "../../src/modules/reservations/reservations.service";
import { assertTestDatabase } from "../fixtures/test-database";

const testUrl = process.env.BOOKING_TEST_DATABASE_URL;

// Local checkout adapter: tests persist real transactions without calling the provider.
class LocalGateway extends SepayPaymentGateway {
  constructor() {
    super({ paymentPrefix: "TEST" });
  }
  override get checkoutConfigured() {
    return true;
  }
  override createCheckoutSession(input: SepayCreateCheckoutInput) {
    return {
      checkoutUrl: "https://checkout.example.test",
      formFields: { order: input.paymentCode },
    };
  }
}

const gateway = new LocalGateway();
const paymentWorkflow = createReservationPaymentsService(db, gateway);
const reservationService = createReservationsService(db);
const appointmentService = createAppointmentsService(db);
const taskService = createFacilityTasksService(db);
const paymentService = new PaymentsService(
  new PaymentsRepository(db),
  gateway,
  undefined,
  paymentWorkflow,
);
const fixtures: Awaited<ReturnType<typeof fixture>>[] = [];

async function fixture() {
  const id = {
    customer: randomUUID(),
    outsider: randomUUID(),
    manager: randomUUID(),
    staff: randomUUID(),
    businessOps: randomUUID(),
    facility: randomUUID(),
    type: randomUUID(),
    unit: randomUUID(),
    slot: randomUUID(),
  };
  await db.insert(users).values([
    {
      id: id.customer,
      email: `${id.customer}@example.test`,
      name: "Customer",
      status: "ACTIVE",
      role: UserRole.STORAGE_CUSTOMER,
    },
    {
      id: id.outsider,
      email: `${id.outsider}@example.test`,
      name: "Other",
      status: "ACTIVE",
      role: UserRole.STORAGE_CUSTOMER,
    },
    {
      id: id.manager,
      email: `${id.manager}@example.test`,
      name: "Manager",
      status: "ACTIVE",
      role: UserRole.FACILITY_MANAGER,
    },
    {
      id: id.staff,
      email: `${id.staff}@example.test`,
      name: "Staff",
      status: "ACTIVE",
      role: UserRole.FACILITY_STAFF,
    },
    {
      id: id.businessOps,
      email: `${id.businessOps}@example.test`,
      name: "Business Operations",
      status: "ACTIVE",
      role: UserRole.BUSINESS_OPERATIONS_MANAGER,
    },
  ]);
  await db
    .insert(facilities)
    .values({ id: id.facility, code: id.facility, name: "Workflow test", address: "Test" });
  await db.insert(facilityAssignments).values([
    { userId: id.manager, facilityId: id.facility, role: UserRole.FACILITY_MANAGER },
    { userId: id.staff, facilityId: id.facility, role: UserRole.FACILITY_STAFF },
  ]);
  await db.insert(unitTypes).values({
    id: id.type,
    facilityId: id.facility,
    code: id.type,
    name: "Test type",
    sizeLabel: "S",
    lengthM: 1,
    widthM: 1,
    heightM: 1,
    monthlyPrice: 100000,
  });
  await db
    .insert(storageUnits)
    .values({ id: id.unit, facilityId: id.facility, unitTypeId: id.type, code: id.unit });
  await db
    .insert(checkInSlots)
    .values({ id: id.slot, name: "Test slot", startTime: "09:00", endTime: "10:00" });
  const date = localDate(new Date(Date.now() + 2 * 86400000), "Asia/Ho_Chi_Minh");
  const input = {
    facilityId: id.facility,
    unitTypeId: id.type,
    durationMonths: 2,
    checkInDate: date,
    checkInSlotId: id.slot,
  };
  const result = {
    id,
    date,
    input,
    manager: { id: id.manager, role: UserRole.FACILITY_MANAGER },
    staff: { id: id.staff, role: UserRole.FACILITY_STAFF },
  };
  fixtures.push(result);
  return result;
}

async function checkout(f: Awaited<ReturnType<typeof fixture>>) {
  const reservation = await reservationService.createReservationDraft(f.input, f.id.customer);
  const input = { idempotencyKey: randomUUID() };
  const session = await paymentWorkflow.startPayment(reservation.id, input, f.id.customer);
  const event: VerifiedPaymentEvent = {
    providerEventId: randomUUID(),
    paymentCode: session.paymentCode,
    amount: reservation.totalAmount,
    transferType: "in",
    referenceCode: randomUUID(),
    metadata: {},
  };
  return { reservation, input, session, event };
}

async function scheduled(f: Awaited<ReturnType<typeof fixture>>) {
  const paid = await checkout(f);
  await paymentWorkflow.processEvent(paid.event);
  const appointment = await appointmentService.scheduleAppointment(
    {
      appointmentType: Type.CHECK_IN,
      reservationId: paid.reservation.id,
      scheduledDate: f.date,
      slotId: f.id.slot,
    },
    f.id.customer,
  );
  return { ...paid, appointment };
}

describe.skipIf(!testUrl)("reservation and appointment workflows with PostgreSQL", () => {
  beforeAll(async () => {
    assertTestDatabase(testUrl);
    await db
      .insert(systemSettings)
      .values([
        { key: "DEPOSIT_MONTHS", value: 1, version: 1, description: "Test" },
        { key: "OPENING_HOUR", value: 8, description: "Test" },
        { key: "CLOSING_HOUR", value: 20, description: "Test" },
      ])
      .onConflictDoNothing();
  });
  afterEach(() => setSystemTime());
  afterAll(async () => {
    for (const f of fixtures) {
      const inspectionRows = await db
        .select({ id: inspections.id })
        .from(inspections)
        .where(eq(inspections.storageUnitId, f.id.unit));
      await db.delete(policyViolationFees).where(
        or(
          inspectionRows.length
            ? inArray(
                policyViolationFees.referenceId,
                inspectionRows.map((row) => row.id),
              )
            : undefined,
          and(
            isNull(policyViolationFees.referenceId),
            eq(policyViolationFees.violationCode, "RETURN_CLEANING"),
          ),
        ),
      );
      const records = await db
        .select({ id: reservations.id })
        .from(reservations)
        .where(eq(reservations.facilityId, f.id.facility));
      await db.delete(notificationOutbox).where(eq(notificationOutbox.facilityId, f.id.facility));
      await db.delete(unitAssignments).where(eq(unitAssignments.physicalUnitId, f.id.unit));
      const closedRentals = await db
        .select({ id: rentals.id })
        .from(rentals)
        .where(eq(rentals.storageUnitId, f.id.unit));
      const rentalIds = closedRentals.map((rental) => rental.id);
      if (rentalIds.length) {
        await db.delete(payments).where(inArray(payments.rentalId, rentalIds));
        const settlements = await db
          .select({ id: returnSettlements.id })
          .from(returnSettlements)
          .where(inArray(returnSettlements.rentalId, rentalIds));
        if (settlements.length)
          await db.delete(debts).where(
            inArray(
              debts.settlementId,
              settlements.map((row) => row.id),
            ),
          );
        await db.delete(returnSettlements).where(inArray(returnSettlements.rentalId, rentalIds));
      }
      await db.delete(inspections).where(eq(inspections.storageUnitId, f.id.unit));
      await db.delete(facilityTasks).where(eq(facilityTasks.facilityId, f.id.facility));
      await db.delete(appointments).where(eq(appointments.facilityId, f.id.facility));
      await db.delete(supportTickets).where(eq(supportTickets.facilityId, f.id.facility));
      const paymentIds = await db
        .select({ id: payments.id })
        .from(payments)
        .where(
          inArray(
            payments.reservationId,
            records.map((row) => row.id),
          ),
        );
      if (paymentIds.length)
        await db.delete(paymentProviderEvents).where(
          inArray(
            paymentProviderEvents.paymentId,
            paymentIds.map((row) => row.id),
          ),
        );
      if (records.length)
        await db.delete(payments).where(
          inArray(
            payments.reservationId,
            records.map((row) => row.id),
          ),
        );
      await db.delete(capacityAllocations).where(eq(capacityAllocations.facilityId, f.id.facility));
      await db.delete(rentals).where(eq(rentals.storageUnitId, f.id.unit));
      await db.delete(reservations).where(eq(reservations.facilityId, f.id.facility));
      await db.delete(bookings).where(eq(bookings.facilityId, f.id.facility));
      await db.delete(facilityAssignments).where(eq(facilityAssignments.facilityId, f.id.facility));
      await db.delete(storageUnits).where(eq(storageUnits.facilityId, f.id.facility));
      await db.delete(unitTypes).where(eq(unitTypes.facilityId, f.id.facility));
      await db.delete(facilities).where(eq(facilities.id, f.id.facility));
      await db.delete(checkInSlots).where(eq(checkInSlots.id, f.id.slot));
      await db
        .delete(users)
        .where(
          inArray(users.id, [
            f.id.customer,
            f.id.outsider,
            f.id.manager,
            f.id.staff,
            f.id.businessOps,
          ]),
        );
    }
  });

  test("retiring booking preserves money, assigned work and history across migration and handover", async () => {
    const f = await fixture();
    const bookingId = randomUUID();
    const taskId = randomUUID();
    const paymentId = randomUUID();
    await db.insert(bookings).values({
      id: bookingId,
      userId: f.id.customer,
      facilityId: f.id.facility,
      unitTypeId: f.id.type,
      assignedStaffId: f.id.staff,
      requestedMonths: 2,
      checkInDate: f.date,
      checkInSlotId: f.id.slot,
      rentalEndAt: new Date(new Date(`${f.date}T09:00:00+07:00`).getTime() + 60 * 86400000),
      monthlyRateSnapshot: "100000",
      rentalFeeAmount: "200000",
      depositAmount: "100000",
      totalAmount: "300000",
      status: "CONFIRMED",
      contactPhone: "0900000000",
    });
    await db.insert(payments).values({
      id: paymentId,
      bookingId,
      provider: "sepay",
      holdTokenHash: randomUUID(),
      providerPaymentId: randomUUID(),
      idempotencyKey: randomUUID(),
      paymentCode: randomUUID().replaceAll("-", ""),
      totalAmount: "300000",
      currency: "VND",
      status: "SUCCEEDED",
      paidAt: new Date(),
    });
    await db.insert(facilityTasks).values({
      id: taskId,
      facilityId: f.id.facility,
      type: FacilityTaskType.CHECK_IN_HANDOVER,
      referenceType: FacilityTaskReferenceType.BOOKING,
      referenceId: bookingId,
      assignedStaffId: f.id.staff,
      assignedBy: f.id.manager,
      status: FacilityTaskStatus.IN_PROGRESS,
      startedAt: new Date(),
    });
    await db
      .insert(unitAssignments)
      .values({ bookingId, physicalUnitId: f.id.unit, assignedBy: f.id.manager });
    await db.update(storageUnits).set({ status: "RESERVED" }).where(eq(storageUnits.id, f.id.unit));
    await db.update(bookings).set({ totalAmount: "300000.50" }).where(eq(bookings.id, bookingId));
    await expect(db.transaction(migrateBookingsToReservations)).rejects.toThrow("integer VND");
    expect(await db.select().from(reservations).where(eq(reservations.id, bookingId))).toHaveLength(
      0,
    );
    expect((await db.select().from(payments).where(eq(payments.id, paymentId)))[0]?.bookingId).toBe(
      bookingId,
    );
    await db.update(bookings).set({ totalAmount: "300000" }).where(eq(bookings.id, bookingId));
    await db.transaction(migrateBookingsToReservations);
    const migrated = await reservationService.getCustomerReservation(bookingId, f.id.customer);
    expect(migrated.totalAmount).toBe(300000);
    expect(migrated.customerId).toBe(f.id.customer);
    expect(
      (await new FacilityAssignmentsRepository(db).findFacilityStaff(f.id.facility))[0]
        ?.assignedTasksCount,
    ).toBe(1);
    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
    expect(payment).toMatchObject({
      bookingId: null,
      reservationId: bookingId,
      status: "SUCCEEDED",
      totalAmount: "300000.00",
    });
    expect((await appointmentService.getAppointment(bookingId, f.manager)).assignedStaffId).toBe(
      f.id.staff,
    );
    const [task] = await db.select().from(facilityTasks).where(eq(facilityTasks.id, taskId));
    expect(task).toMatchObject({
      referenceType: FacilityTaskReferenceType.APPOINTMENT,
      referenceId: bookingId,
      status: FacilityTaskStatus.IN_PROGRESS,
    });
    const app = Fastify();
    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    const session = spyOn(auth.api, "getSession").mockResolvedValue({
      user: { ...f.staff, status: "ACTIVE" },
      session: {},
    } as never);
    try {
      await app.register(inspectionsRoutes, { prefix: "/api" });
      setSystemTime(new Date(`${f.date}T09:15:00+07:00`));
      const history = await app.inject({
        method: "GET",
        url: `/api/inspections/appointments/${bookingId}`,
      });
      expect(history.statusCode).toBe(200);
      const inspection = history.json().data[0];
      expect(inspection.storageUnitId).toBe(f.id.unit);
      const results = HANDOVER_CHECKLIST_ITEMS.map((item) => ({
        itemCode: item.code,
        resultType: "PASS_FAIL",
        result: "PASS",
        note: null,
        photos: [],
      }));
      const completed = await app.inject({
        method: "PATCH",
        url: `/api/inspections/${inspection.id}`,
        payload: { status: "PASSED", condition: "GOOD", checklist: { results } },
      });
      expect(completed.statusCode).toBe(200);
      const handover = await app.inject({
        method: "POST",
        url: `/api/inspections/${inspection.id}/handover`,
        payload: { customerReceivedUnit: true },
      });
      expect(handover.statusCode).toBe(200);
      await db.transaction(migrateBookingsToReservations);
      expect(
        (await reservationService.getCustomerReservation(bookingId, f.id.customer)).status,
      ).toBe(ReservationStatus.CHECKED_IN);
      expect(
        await db.select().from(rentals).where(eq(rentals.reservationId, bookingId)),
      ).toHaveLength(1);
      const [archived] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
      expect(archived?.totalAmount).toBe("300000.00");
      expect(
        (await new FacilityAssignmentsRepository(db).findFacilityStaff(f.id.facility))[0]
          ?.assignedTasksCount,
      ).toBe(0);
    } finally {
      session.mockRestore();
      await app.close();
    }
  });

  test.each(["develop", "development"] as const)(
    "%s supports same-day demo check-in through real inspection and handover",
    async (mode) => {
      const previous = env.NODE_ENV;
      const f = await fixture();
      const app = Fastify();
      app.decorate("db", db);
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);
      setupErrorHandler(app);
      const session = spyOn(auth.api, "getSession").mockResolvedValue({
        user: { ...f.staff, status: "ACTIVE" },
        session: {},
      } as never);
      try {
        env.NODE_ENV = mode;
        setSystemTime(new Date(`${f.date}T15:15:00+07:00`));
        await db
          .update(checkInSlots)
          .set({ startTime: "15:13", endTime: "23:59:59.999999" })
          .where(eq(checkInSlots.id, f.id.slot));
        const paid = await checkout(f);
        await paymentWorkflow.processEvent(paid.event);
        expect(
          (await reservationService.getCustomerReservation(paid.reservation.id, f.id.customer))
            .status,
        ).toBe(ReservationStatus.CONFIRMED);
        const appointment = await appointmentService.scheduleAppointment(
          {
            appointmentType: Type.CHECK_IN,
            reservationId: paid.reservation.id,
            scheduledDate: f.date,
            slotId: f.id.slot,
          },
          f.id.customer,
        );
        await appointmentService.updateAppointment(
          appointment.id,
          { status: Status.CONFIRMED, assignedStaffId: f.id.staff, physicalUnitId: f.id.unit },
          f.manager,
        );
        const [task] = await db
          .select()
          .from(facilityTasks)
          .where(eq(facilityTasks.referenceId, appointment.id));
        if (!task) throw new Error("Missing demo task");
        setSystemTime(new Date(new Date(`${f.date}T00:01:00+07:00`).getTime() + 86400000));
        expect(await reservationService.sweepNoShows()).toEqual({ processed: 0 });
        await taskService.update(task.id, { status: FacilityTaskStatus.IN_PROGRESS }, f.staff);
        await app.register(inspectionsRoutes, { prefix: "/api" });
        const created = await app.inject({
          method: "POST",
          url: "/api/inspections",
          payload: { taskId: task.id, storageUnitId: f.id.unit },
        });
        expect(created.statusCode, created.body).toBe(201);
        const inspectionId = created.json().data.id;
        const early = await app.inject({
          method: "POST",
          url: `/api/inspections/${inspectionId}/handover`,
          payload: { customerReceivedUnit: true },
        });
        expect(early.statusCode).toBe(409);
        const checked = await app.inject({
          method: "PATCH",
          url: `/api/inspections/${inspectionId}`,
          payload: {
            status: "PASSED",
            condition: "GOOD",
            checklist: {
              results: HANDOVER_CHECKLIST_ITEMS.map((item) => ({
                itemCode: item.code,
                resultType: "PASS_FAIL",
                result: "PASS",
                note: null,
                photos: [],
              })),
            },
          },
        });
        expect(checked.statusCode, checked.body).toBe(200);
        const handedOver = await app.inject({
          method: "POST",
          url: `/api/inspections/${inspectionId}/handover`,
          payload: { customerReceivedUnit: true },
        });
        expect(handedOver.statusCode, handedOver.body).toBe(200);
        expect((await appointmentService.getAppointment(appointment.id, f.staff)).status).toBe(
          Status.COMPLETED,
        );
        expect(
          (await reservationService.getCustomerReservation(paid.reservation.id, f.id.customer))
            .status,
        ).toBe(ReservationStatus.CHECKED_IN);
      } finally {
        env.NODE_ENV = previous;
        session.mockRestore();
        await app.close();
      }
    },
  );

  test("HTTP routes await services and honor the facility from the validated path", async () => {
    const f = await fixture();
    const app = Fastify();
    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    const session = spyOn(auth.api, "getSession").mockResolvedValue({
      user: { id: f.id.customer, role: UserRole.STORAGE_CUSTOMER, status: "ACTIVE" },
      session: {},
    } as never);
    try {
      await app.register(reservationsRoutes, { prefix: "/api/reservations" });
      await app.register(appointmentsRoutes, { prefix: "/api/appointments" });
      expect((await app.inject({ method: "GET", url: "/api/bookings/mine" })).statusCode).toBe(404);
      const draft = await app.inject({
        method: "POST",
        url: "/api/reservations/drafts",
        payload: f.input,
      });
      expect(draft.statusCode).toBe(201);
      expect(draft.json().data.customerId).toBe(f.id.customer);
      const detail = await app.inject({
        method: "GET",
        url: `/api/reservations/${draft.json().data.id}`,
      });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().data.totalAmount).toBe(300000);
      session.mockResolvedValue({ user: { ...f.manager, status: "ACTIVE" }, session: {} } as never);
      const list = await app.inject({
        method: "GET",
        url: `/api/appointments/facilities/${f.id.facility}?facilityId=${randomUUID()}`,
      });
      expect(list.statusCode).toBe(200);
      expect(list.json().data).toEqual([]);
      const forbidden = await app.inject({
        method: "GET",
        url: `/api/appointments/facilities/${randomUUID()}?facilityId=${f.id.facility}`,
      });
      expect(forbidden.statusCode).toBe(403);
    } finally {
      session.mockRestore();
      await app.close();
    }
  });

  test("drafts snapshot pricing and enforce owner/facility boundaries", async () => {
    const f = await fixture();
    const reservation = await reservationService.createReservationDraft(f.input, f.id.customer);
    expect(reservation.totalAmount).toBe(300000);
    expect(reservation.rentalFeeAmount).toBe(200000);
    await expect(
      reservationService.getReservation(reservation.id, {
        id: f.id.outsider,
        role: UserRole.STORAGE_CUSTOMER,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      reservationService.listFacilityReservations(randomUUID(), {}, f.id.manager),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      reservationService.createReservationDraft(
        { ...f.input, checkInDate: localDate(new Date(), "Asia/Ho_Chi_Minh") },
        f.id.customer,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("payment replay reuses its hold and competing checkouts cannot oversell", async () => {
    const f = await fixture();
    const first = await checkout(f);
    const replay = await paymentWorkflow.startPayment(
      first.reservation.id,
      first.input,
      f.id.customer,
    );
    expect(replay.paymentId).toBe(first.session.paymentId);
    await expect(
      reservationService.cancelReservation(first.reservation.id, f.id.customer),
    ).rejects.toMatchObject({ statusCode: 409 });
    const [second] = await db
      .insert(reservations)
      .values({ ...first.reservation, id: randomUUID() })
      .returning();
    if (!second) throw new Error("Missing fixture");
    await expect(
      paymentWorkflow.startPayment(second.id, { idempotencyKey: randomUUID() }, f.id.customer),
    ).rejects.toMatchObject({ statusCode: 409 });
    const holds = await db
      .select()
      .from(capacityAllocations)
      .where(eq(capacityAllocations.facilityId, f.id.facility));
    expect(holds).toHaveLength(1);
  });

  test("simultaneous checkouts serialize capacity across different reservations", async () => {
    const f = await fixture();
    const drafts = await Promise.all([
      reservationService.createReservationDraft(f.input, f.id.customer),
      reservationService.createReservationDraft(f.input, f.id.customer),
    ]);
    const results = await Promise.allSettled(
      drafts.map((draft) =>
        paymentWorkflow.startPayment(draft.id, { idempotencyKey: randomUUID() }, f.id.customer),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(
      await db
        .select()
        .from(capacityAllocations)
        .where(eq(capacityAllocations.facilityId, f.id.facility)),
    ).toHaveLength(1);
  });

  test("verified payments confirm once, preserve capacity, and authorize status reads", async () => {
    const f = await fixture();
    const paid = await checkout(f);
    expect((await paymentWorkflow.processEvent({ ...paid.event, amount: 1 }))?.processed).toBe(
      false,
    );
    const verified = spyOn(gateway, "verifyWebhook").mockReturnValue(paid.event);
    try {
      expect((await paymentService.handleSepayWebhook({}, "verified-fixture")).processed).toBe(
        true,
      );
      expect((await paymentService.handleSepayWebhook({}, "verified-fixture")).duplicate).toBe(
        true,
      );
    } finally {
      verified.mockRestore();
    }
    expect((await paymentWorkflow.processEvent(paid.event))?.duplicate).toBe(true);
    expect(
      (await reservationService.getCustomerReservation(paid.reservation.id, f.id.customer)).status,
    ).toBe(ReservationStatus.CONFIRMED);
    const reports = new ReportsRepository(db);
    const from = new Date(Date.now() - 86400000),
      to = new Date(Date.now() + 86400000),
      asOf = new Date(Date.now() + 1000);
    const report = await reports.read(f.manager, { facilityId: f.id.facility }, from, to, asOf);
    expect(Number(report.financial[0]?.rentalCollected)).toBe(200000);
    expect(Number(report.financial[0]?.depositCollected)).toBe(100000);
    expect(report.financial[0]?.unclassifiedCollectedPayments).toBe(0);
    expect(report.awaiting.reduce((sum, row) => sum + row.count, 0)).toBe(1);
    const monthly = await reports.monthlyRevenue(
      f.manager,
      { facilityId: f.id.facility },
      from,
      to,
      asOf,
    );
    expect(Number(monthly.receipts[0]?.cashReceived)).toBe(300000);
    const [hold] = await db
      .select()
      .from(capacityAllocations)
      .where(eq(capacityAllocations.referenceId, paid.reservation.id));
    expect(hold?.kind).toBe("RESERVATION");
    await expect(
      paymentService.getStatus(paid.session.paymentId, { userId: f.id.outsider }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(
      (await paymentService.getStatus(paid.session.paymentId, { userId: f.id.customer }))
        .reservationId,
    ).toBe(paid.reservation.id);
  });

  test("late payment with lost capacity is queued for a full refund", async () => {
    const f = await fixture();
    const paid = await checkout(f);
    await db
      .update(capacityAllocations)
      .set({ status: "EXPIRED" })
      .where(eq(capacityAllocations.referenceId, paid.reservation.id));
    await db.insert(capacityAllocations).values({
      facilityId: f.id.facility,
      unitTypeId: f.id.type,
      referenceId: randomUUID(),
      kind: "RESERVATION",
      startsAt: paid.reservation.rentalStartAt,
      endsAt: paid.reservation.rentalEndAt,
    });
    await paymentWorkflow.processEvent(paid.event);
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paid.session.paymentId));
    expect(payment?.status).toBe("REFUND_PENDING");
    expect(payment?.refundReason).toBe("NO_CAPACITY");
    expect(Number(payment?.refundAmount)).toBe(paid.reservation.totalAmount);
  });

  test("cancellation closes linked work and refunds rental fees while forfeiting deposit", async () => {
    const f = await fixture();
    const paid = await scheduled(f);
    await appointmentService.assignAppointmentStaff(
      paid.appointment.id,
      { staffId: f.id.staff },
      f.id.manager,
    );
    await reservationService.cancelReservation(paid.reservation.id, f.id.customer);
    expect((await appointmentService.getAppointment(paid.appointment.id, f.manager)).status).toBe(
      Status.CANCELLED,
    );
    const [task] = await db
      .select()
      .from(facilityTasks)
      .where(eq(facilityTasks.referenceId, paid.appointment.id));
    expect(task?.status).toBe(FacilityTaskStatus.CANCELLED);
    const refunds = await paymentService.listManualRefunds({ limit: 100, offset: 0 });
    const refund = refunds.find((row) => row.paymentId === paid.session.paymentId);
    expect(Number(refund?.amount)).toBe(200000);
    expect(Number(refund?.depositForfeitedAmount)).toBe(100000);
    expect(refund?.contactEmail).toBe(`${f.id.customer}@example.test`);
    expect(
      (
        await paymentService.confirmManualRefund(
          paid.session.paymentId,
          "test-bank-transfer",
          f.id.manager,
        )
      ).status,
    ).toBe("REFUNDED");
  });

  test("FM unit assignment preserves capacity, rejects competing assignments and releases on cancellation", async () => {
    const f = await fixture();
    await db
      .insert(storageUnits)
      .values({ facilityId: f.id.facility, unitTypeId: f.id.type, code: randomUUID() });
    const first = await scheduled(f),
      second = await scheduled(f);
    const assignments = await Promise.allSettled(
      [first, second].map((p) =>
        appointmentService.updateAppointment(
          p.appointment.id,
          { physicalUnitId: f.id.unit, assignedStaffId: f.id.staff, status: Status.CONFIRMED },
          f.manager,
        ),
      ),
    );
    expect(assignments.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(assignments.filter((x) => x.status === "rejected")).toHaveLength(1);
    const winner = assignments[0]?.status === "fulfilled" ? first : second;
    expect(
      (await appointmentService.getAppointment(winner.appointment.id, f.manager)).assignedUnit
        ?.physicalUnitId,
    ).toBe(f.id.unit);
    expect(
      (await db.select().from(storageUnits).where(eq(storageUnits.id, f.id.unit)))[0]?.status,
    ).toBe("RESERVED");
    const availability = await reservationService.availability(f.input);
    expect(availability.availableCount).toBe(0);
    await expect(
      appointmentService.updateAppointment(
        winner.appointment.id,
        { physicalUnitId: f.id.unit },
        { id: f.id.customer, role: UserRole.STORAGE_CUSTOMER },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    await reservationService.cancelReservation(winner.reservation.id, f.id.customer);
    expect(
      (await db.select().from(storageUnits).where(eq(storageUnits.id, f.id.unit)))[0]?.status,
    ).toBe("AVAILABLE");
    expect(
      (
        await db
          .select()
          .from(unitAssignments)
          .where(eq(unitAssignments.reservationId, winner.reservation.id))
      )[0]?.status,
    ).toBe("CANCELLED");
  });

  test("appointment tasks require assignment, schedule, and completed handover", async () => {
    const f = await fixture();
    const paid = await scheduled(f);
    await expect(
      appointmentService.updateAppointment(
        paid.appointment.id,
        { status: Status.CONFIRMED },
        f.manager,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      appointmentService.assignAppointmentStaff(
        paid.appointment.id,
        { staffId: f.id.outsider },
        f.id.manager,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    await appointmentService.updateAppointment(
      paid.appointment.id,
      { assignedStaffId: f.id.staff, status: Status.CONFIRMED },
      f.manager,
    );
    const [task] = await db
      .select()
      .from(facilityTasks)
      .where(eq(facilityTasks.referenceId, paid.appointment.id));
    if (!task) throw new Error("Missing task");
    await expect(
      taskService.update(task.id, { status: FacilityTaskStatus.IN_PROGRESS }, f.staff),
    ).rejects.toMatchObject({ statusCode: 409 });
    setSystemTime(new Date(`${f.date}T09:15:00+07:00`));
    await taskService.update(task.id, { status: FacilityTaskStatus.IN_PROGRESS }, f.staff);
    await expect(
      appointmentService.updateAppointment(
        paid.appointment.id,
        { status: Status.COMPLETED },
        f.staff,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      taskService.update(task.id, { status: FacilityTaskStatus.COMPLETED }, f.staff),
    ).rejects.toMatchObject({ statusCode: 409 });
    // Simulate the handover module's committed result; the appointment cannot create it.
    await db
      .update(reservations)
      .set({ status: ReservationStatus.CHECKED_IN })
      .where(eq(reservations.id, paid.reservation.id));
    await appointmentService.updateAppointment(
      paid.appointment.id,
      { status: Status.COMPLETED },
      f.staff,
    );
    const [completed] = await db.select().from(facilityTasks).where(eq(facilityTasks.id, task.id));
    expect(completed?.status).toBe(FacilityTaskStatus.COMPLETED);
  });

  for (const deductionAmount of [0, 100000, 150000]) {
    test(`return settlement handles deductions ${deductionAmount}, maintenance and subsequent debt collection`, async () => {
      const f = await fixture();
      const paid = await checkout(f);
      await paymentWorkflow.processEvent(paid.event);
      await db
        .update(reservations)
        .set({ status: ReservationStatus.CHECKED_IN })
        .where(eq(reservations.id, paid.reservation.id));
      await db
        .update(storageUnits)
        .set({ status: "OCCUPIED" })
        .where(eq(storageUnits.id, f.id.unit));
      const [rental] = await db
        .insert(rentals)
        .values({
          reservationId: paid.reservation.id,
          userId: f.id.customer,
          storageUnitId: f.id.unit,
          startAt: new Date(`${f.date}T08:00:00+07:00`),
          endAt: new Date(new Date(`${f.date}T08:00:00+07:00`).getTime() + 60 * 86400000),
        })
        .returning();
      if (!rental) throw new Error("Missing rental");
      const appointment = await appointmentService.scheduleAppointment(
        {
          appointmentType: Type.CHECK_OUT,
          rentalId: rental.id,
          scheduledDate: f.date,
          slotId: f.id.slot,
        },
        f.id.customer,
      );
      await appointmentService.updateAppointment(
        appointment.id,
        { status: Status.CONFIRMED, assignedStaffId: f.id.staff },
        f.manager,
      );
      setSystemTime(new Date(`${f.date}T09:15:00+07:00`));
      const [task] = await db
        .select()
        .from(facilityTasks)
        .where(eq(facilityTasks.referenceId, appointment.id));
      if (!task) throw new Error("Missing task");
      await taskService.update(task.id, { status: FacilityTaskStatus.IN_PROGRESS }, f.staff);
      const app = Fastify();
      app.decorate("db", db);
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);
      setupErrorHandler(app);
      const session = spyOn(auth.api, "getSession").mockResolvedValue({
        user: { ...f.staff, status: "ACTIVE" },
        session: {},
      } as never);
      try {
        await app.register(inspectionsRoutes, { prefix: "/api" });
        await app.register(paymentsRoutes, { prefix: "/api" });
        const created = await app.inject({
          method: "POST",
          url: "/api/inspections",
          payload: { taskId: task.id },
        });
        expect(created.statusCode).toBe(201);
        const inspection = created.json().data;
        if (deductionAmount)
          await db.insert(policyViolationFees).values({
            referenceType: "INSPECTION",
            referenceId: inspection.id,
            violationCode: "TEST_DAMAGE",
            violationName: "Damage",
            amount: deductionAmount,
            policyVersion: 1,
            isActive: false,
          });
        const payload = {
          status: "PASSED",
          condition: deductionAmount ? "MAJOR_DAMAGE" : "GOOD",
          checklist: {
            results: HANDOVER_CHECKLIST_ITEMS.map((item) => ({
              itemCode: item.code,
              resultType: "PASS_FAIL",
              result: deductionAmount ? "FAIL" : "PASS",
              note: deductionAmount ? "Documented damage" : null,
              photos: [],
            })),
          },
          settlement: {
            confirmed: true,
            deductionAmount,
            ...(deductionAmount < 100000
              ? { refund: { method: "BANK_TRANSFER", reference: "RETURN-TEST" } }
              : {}),
          },
        };
        const missingConfirmation = await app.inject({
          method: "PATCH",
          url: `/api/inspections/${inspection.id}`,
          payload: { ...payload, settlement: undefined },
        });
        expect(missingConfirmation.statusCode).toBe(409);
        expect((await db.select().from(rentals).where(eq(rentals.id, rental.id)))[0]?.status).toBe(
          "ACTIVE",
        );
        const completed = await app.inject({
          method: "PATCH",
          url: `/api/inspections/${inspection.id}`,
          payload,
        });
        expect(completed.statusCode).toBe(200);
        expect((await db.select().from(rentals).where(eq(rentals.id, rental.id)))[0]?.status).toBe(
          "CLOSED",
        );
        expect(
          (await db.select().from(storageUnits).where(eq(storageUnits.id, f.id.unit)))[0]?.status,
        ).toBe(deductionAmount ? "MAINTENANCE" : "AVAILABLE");
        expect(
          (await app.inject({ method: "PATCH", url: `/api/inspections/${inspection.id}`, payload }))
            .statusCode,
        ).toBe(200);
        const settlements = await db
          .select()
          .from(returnSettlements)
          .where(eq(returnSettlements.rentalId, rental.id));
        expect(settlements).toHaveLength(1);
        const changedReplay = await app.inject({
          method: "PATCH",
          url: `/api/inspections/${inspection.id}`,
          payload: {
            ...payload,
            settlement: { ...payload.settlement, deductionAmount: deductionAmount + 1 },
          },
        });
        expect(changedReplay.statusCode).toBe(409);
        const source = (
          await db.select().from(payments).where(eq(payments.id, paid.session.paymentId))
        )[0];
        expect(source).toMatchObject({ status: "SUCCEEDED", totalAmount: "300000.00" });
        const reports = new ReportsRepository(db);
        const from = new Date(Date.now() - 10 * 86400000),
          to = new Date(Date.now() + 86400000);
        const report = await reports.read(
          f.manager,
          { facilityId: f.id.facility },
          from,
          to,
          new Date(),
        );
        expect(Number(report.financial[0]?.cashReceived)).toBe(300000);
        expect(Number(report.financial[0]?.cashRefunded)).toBe(
          Math.max(0, 100000 - deductionAmount),
        );
        expect(Number(report.returnPenalties[0]?.amount)).toBe(Math.min(100000, deductionAmount));

        const refunds = await db
          .select()
          .from(payments)
          .where(
            and(eq(payments.rentalId, rental.id), eq(payments.type, PaymentType.DEPOSIT_REFUND)),
          );
        expect(refunds).toHaveLength(deductionAmount < 100000 ? 1 : 0);
        if (refunds[0])
          expect(refunds[0]).toMatchObject({
            status: "REFUNDED",
            refundedBy: f.id.staff,
            refundReference: "RETURN-TEST",
          });
        const list = await app.inject({ method: "GET", url: `/api/debts?rentalId=${rental.id}` });
        expect(list.statusCode).toBe(200);
        expect(list.json().data.items).toHaveLength(deductionAmount > 100000 ? 1 : 0);
        if (deductionAmount <= 100000) return;
        const debt = list.json().data.items[0];
        const input = { amount: 20000, method: "CASH", idempotencyKey: randomUUID() };
        const collect = () =>
          app.inject({ method: "POST", url: `/api/debts/${debt.id}/payments`, payload: input });
        const concurrent = await Promise.all([collect(), collect()]);
        expect(concurrent.map((response) => response.statusCode)).toEqual([200, 200]);
        expect(concurrent[1]?.json().data).toMatchObject({
          status: "PARTIALLY_PAID",
          paidAmount: "20000.00",
          remainingAmount: "30000",
        });
        expect(concurrent[1]?.json().data.payments).toHaveLength(1);
        const excess = await app.inject({
          method: "POST",
          url: `/api/debts/${debt.id}/payments`,
          payload: { ...input, amount: 30001, idempotencyKey: randomUUID() },
        });
        expect(excess.statusCode).toBe(409);
        const conflict = await app.inject({
          method: "POST",
          url: `/api/debts/${debt.id}/payments`,
          payload: { ...input, amount: 20001 },
        });
        expect(conflict.statusCode).toBe(409);
        session.mockResolvedValue({
          user: { id: f.id.outsider, role: "CUSTOMER", status: "ACTIVE" },
          session: {},
        } as never);
        expect((await app.inject({ method: "GET", url: `/api/debts/${debt.id}` })).statusCode).toBe(
          404,
        );
        session.mockResolvedValue({
          user: { ...f.manager, status: "ACTIVE" },
          session: {},
        } as never);
        expect((await collect()).statusCode).toBe(403);
        expect((await app.inject({ method: "GET", url: `/api/debts/${debt.id}` })).statusCode).toBe(
          200,
        );
        session.mockResolvedValue({ user: { ...f.staff, status: "ACTIVE" }, session: {} } as never);
        const finalPayment = await app.inject({
          method: "POST",
          url: `/api/debts/${debt.id}/payments`,
          payload: {
            amount: 30000,
            method: "BANK_TRANSFER",
            reference: "DEBT-FINAL",
            idempotencyKey: randomUUID(),
          },
        });
        expect(finalPayment.statusCode).toBe(200);
        expect(finalPayment.json().data).toMatchObject({ status: "PAID", remainingAmount: "0" });
        const collectedReport = await reports.read(
          f.manager,
          { facilityId: f.id.facility },
          from,
          to,
          new Date(),
        );
        expect(Number(collectedReport.financial[0]?.cashReceived)).toBe(350000);
        expect(collectedReport.financial[0]?.unclassifiedCollectedPayments).toBe(0);
        const monthly = await reports.monthlyRevenue(
          f.manager,
          { facilityId: f.id.facility },
          from,
          to,
          new Date(),
        );
        expect(
          monthly.receipts.reduce((sum, receipt) => sum + Number(receipt.cashReceived), 0),
        ).toBe(350000);
      } finally {
        session.mockRestore();
        await app.close();
      }
    });
  }

  test("return and support appointments use their owning modules and serialize confirmed slots", async () => {
    const f = await fixture();
    const rentalIds: string[] = [];
    for (let index = 0; index < 2; index++) {
      const [booking] = await db
        .insert(bookings)
        .values({
          userId: f.id.customer,
          facilityId: f.id.facility,
          unitTypeId: f.id.type,
          requestedMonths: 2,
          checkInDate: f.date,
          checkInSlotId: f.id.slot,
          rentalEndAt: new Date(Date.now() + 60 * 86400000),
          monthlyRateSnapshot: "100000",
          rentalFeeAmount: "200000",
          depositAmount: "100000",
          totalAmount: "300000",
          status: "CHECKED_IN",
          contactPhone: "0901234567",
        })
        .returning();
      if (!booking) throw new Error("Missing booking");
      const [rental] = await db
        .insert(rentals)
        .values({
          bookingId: booking.id,
          userId: f.id.customer,
          storageUnitId: f.id.unit,
          startAt: new Date(Date.now() - 86400000),
          endAt: booking.rentalEndAt,
        })
        .returning();
      if (!rental) throw new Error("Missing rental");
      rentalIds.push(rental.id);
    }
    const returnInput = {
      appointmentType: Type.CHECK_OUT,
      rentalId: rentalIds[0],
      scheduledDate: f.date,
      slotId: f.id.slot,
    };
    await expect(
      appointmentService.scheduleAppointment(returnInput, f.id.outsider),
    ).rejects.toMatchObject({ statusCode: 404 });
    const first = await appointmentService.scheduleAppointment(returnInput, f.id.customer);
    const second = await appointmentService.scheduleAppointment(
      { ...returnInput, rentalId: rentalIds[1] },
      f.id.customer,
    );
    await appointmentService.updateAppointment(
      first.id,
      { assignedStaffId: f.id.staff, status: Status.CONFIRMED },
      f.manager,
    );
    await expect(
      appointmentService.updateAppointment(
        second.id,
        { assignedStaffId: f.id.staff, status: Status.CONFIRMED },
        f.manager,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    const [rental] = await db
      .select()
      .from(rentals)
      .where(eq(rentals.id, rentalIds[0] ?? ""));
    if (!rental) throw new Error("Missing rental");
    const [ticket] = await db
      .insert(supportTickets)
      .values({
        bookingId: rental.bookingId,
        ownerUserId: f.id.customer,
        facilityId: f.id.facility,
        rentalId: rental.id,
        category: "UNIT",
        subject: "Test",
        description: "Test request",
        actionDueAt: new Date(Date.now() + 12 * 3600000),
        idempotencyKey: randomUUID(),
      })
      .returning();
    if (!ticket) throw new Error("Missing ticket");
    const support = await appointmentService.scheduleAppointment(
      {
        appointmentType: Type.SUPPORT,
        supportTicketId: ticket.id,
        scheduledDate: f.date,
        slotId: f.id.slot,
      },
      f.id.customer,
    );
    await appointmentService.updateAppointment(
      support.id,
      { assignedStaffId: f.id.staff, status: Status.CONFIRMED },
      f.manager,
    );
    setSystemTime(new Date(`${f.date}T09:15:00+07:00`));
    for (const meeting of [first, support]) {
      const [task] = await db
        .select()
        .from(facilityTasks)
        .where(eq(facilityTasks.referenceId, meeting.id));
      if (!task) throw new Error("Missing task");
      await taskService.update(task.id, { status: FacilityTaskStatus.IN_PROGRESS }, f.staff);
    }
    await expect(
      appointmentService.updateAppointment(first.id, { status: Status.COMPLETED }, f.staff),
    ).rejects.toMatchObject({ statusCode: 409 });
    await db.update(rentals).set({ status: RentalStatus.CLOSED }).where(eq(rentals.id, rental.id));
    expect(
      (await appointmentService.updateAppointment(first.id, { status: Status.COMPLETED }, f.staff))
        .status,
    ).toBe(Status.COMPLETED);
    expect(
      (
        await appointmentService.updateAppointment(
          support.id,
          { status: Status.COMPLETED },
          f.staff,
        )
      ).status,
    ).toBe(Status.COMPLETED);
  });

  test("no-show sweep uses closing time and releases paid capacity exactly once", async () => {
    const f = await fixture();
    const paid = await scheduled(f);
    expect(
      (await reservationService.sweepNoShows(new Date(`${f.date}T19:59:00+07:00`), f.id.facility))
        .processed,
    ).toBe(0);
    expect(
      (await reservationService.sweepNoShows(new Date(`${f.date}T20:00:00+07:00`), f.id.facility))
        .processed,
    ).toBe(1);
    expect(
      (await reservationService.sweepNoShows(new Date(`${f.date}T21:00:00+07:00`), f.id.facility))
        .processed,
    ).toBe(0);
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paid.session.paymentId));
    expect(payment?.refundReason).toBe("NO_SHOW");
    expect(Number(payment?.refundAmount)).toBe(200000);
  });
});
