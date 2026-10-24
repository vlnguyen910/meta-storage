import { afterAll, beforeAll, describe, expect, setSystemTime, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  accounts,
  and,
  bookings,
  capacityAllocations,
  checkInSlots,
  type Database,
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
  queryClient,
  rentalChargeAdjustments,
  rentalChargeEvents,
  rentalChargeRefunds,
  rentalCharges,
  rentals,
  returnAudit,
  returnChecklistVersions,
  returnEvidencePhotos,
  returnInspectionPhotos,
  returnInspections,
  returnRefunds,
  returnRequests,
  returnSettlements,
  returnTimeChanges,
  storageUnits,
  systemSettingChanges,
  systemSettings,
  unitAssignments,
  unitTypes,
  users,
} from "@metastorage/database";
import {
  BOOKING_ACCESS,
  bookingDeliveryKey,
  bookingMagicKey,
} from "@metastorage/shared/booking-access";
import {
  decryptMailPayload,
  encryptMailPayload,
  type MailJobData,
  mailJobId,
} from "@metastorage/shared/mail";
import { Queue } from "bullmq";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import Redis from "ioredis";
import { BookingMailService } from "../../../worker/src/notifications/booking-mail.service";
import { OutboxRepository } from "../../../worker/src/notifications/outbox.repository";
import { OutboxService } from "../../../worker/src/notifications/outbox.service";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { swaggerPlugin } from "../../src/common/plugins/swagger";
import { auth } from "../../src/modules/auth/auth";
import { authPlugin } from "../../src/modules/auth/auth.guard";
import { authRoutes } from "../../src/modules/auth/auth.routes";
import { BookingsRepository } from "../../src/modules/bookings/bookings.repository";
import { createBookingsService } from "../../src/modules/bookings/bookings.service";
import { facilitiesRoutes } from "../../src/modules/facilities/facilities.routes";
import { InspectionsRepository } from "../../src/modules/inspections/inspections.repository";
import { recordLifecycleEvent } from "../../src/modules/notifications/lifecycle-notifications.repository";
import { lifecycleNotificationsRoutes } from "../../src/modules/notifications/lifecycle-notifications.routes";
import { PaymentsRepository } from "../../src/modules/payments/payments.repository";
import { rentalLifecycleSettingsRoutes } from "../../src/modules/rental-lifecycle-settings/rental-lifecycle-settings.routes";
import { RentalLifecycleRepository } from "../../src/modules/rentals/rental-lifecycle.repository";
import {
  RentalLifecycleService,
  recordImmediateExpiry,
} from "../../src/modules/rentals/rental-lifecycle.service";
import { rentalsRoutes } from "../../src/modules/rentals/rentals.routes";
import { ReturnsRepository } from "../../src/modules/returns/returns.repository";
import { returnsRoutes } from "../../src/modules/returns/returns.routes";
import { ReturnsService } from "../../src/modules/returns/returns.service";
import { createTestUnitType, deleteTestUnitTypes } from "../fixtures/facility-catalog";
import { assertTestDatabase } from "../fixtures/test-database";

const target = process.env.MY_STORAGE_LOCAL_DATABASE_URL;
const app = Fastify();
const roles = {
  owner: "CUSTOMER",
  other: "CUSTOMER",
  staff: "FACILITY_STAFF",
  replacement: "FACILITY_STAFF",
  manager: "FACILITY_MANAGER",
  outsider: "FACILITY_MANAGER",
  admin: "SYSTEM_ADMIN",
  bom: "BUSINESS_OPERATION_MANAGER",
} as const;
const actorIds = Object.fromEntries(Object.keys(roles).map((key) => [key, randomUUID()])) as Record<
  keyof typeof roles,
  string
>;
const cookies = {} as Record<keyof typeof roles, string>;
const fixture = {
  facility: randomUUID(),
  otherFacility: randomUUID(),
  unitType: randomUUID(),
  slot: randomUUID(),
};
const password = "ReturnsTest123!";
const assets = new Set<string>();
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64");
const definition = [
  { code: "PROPERTY", label: "Tài sản còn lại", group: "REMAINING_PROPERTY", serious: false },
  { code: "UNIT", label: "Tình trạng unit", group: "UNIT_CONDITION", serious: true },
  { code: "HYGIENE", label: "Vệ sinh/an toàn", group: "HYGIENE_SAFETY", serious: false },
  { code: "EVIDENCE", label: "Bằng chứng", group: "EVIDENCE", serious: false },
];
let scenarioNumber = 0;
let initialRate = 25;
let initialLifecycleSettings: (typeof systemSettings.$inferSelect)[] = [];
let latestChecklistVersion = 0;
let setupStarted = false;

async function api(
  who: keyof typeof roles | null,
  method: "GET" | "POST" | "PUT" | "PATCH",
  path: string,
  payload?: unknown,
) {
  return app.inject({
    method,
    url: `/api${path}`,
    headers: who ? { cookie: cookies[who] } : {},
    payload,
  });
}
async function state(id: string) {
  const response = await api("manager", "GET", `/return-requests/${id}`);
  expect(response.statusCode).toBe(200);
  return response.json().data;
}
async function scenario(status: "CONFIRMED" | "PENDING" = "CONFIRMED") {
  const unitId = randomUUID(),
    bookingId = randomUUID(),
    rentalId = randomUUID(),
    requestId = randomUUID();
  const date = new Date(Date.UTC(2032, 1, ++scenarioNumber)).toISOString().slice(0, 10);
  await db.transaction(async (tx) => {
    await tx.insert(storageUnits).values({
      id: unitId,
      code: unitId,
      facilityId: fixture.facility,
      unitTypeId: fixture.unitType,
      status: "OCCUPIED",
    });
    await tx.insert(bookings).values({
      id: bookingId,
      userId: actorIds.owner,
      facilityId: fixture.facility,
      unitTypeId: fixture.unitType,
      requestedMonths: 1,
      checkInDate: "2031-12-01",
      checkInSlotId: fixture.slot,
      rentalEndAt: new Date("2032-01-01T03:00:00Z"),
      monthlyRateSnapshot: "1000000",
      rentalFeeAmount: "1000000",
      depositAmount: "1000000",
      totalAmount: "2000000",
      status: "CHECKED_IN",
      contactName: "Return test",
      contactEmail: "contact@example.test",
      contactPhone: "0900000000",
    });
    const paymentId = randomUUID();
    await tx.insert(payments).values({
      id: paymentId,
      bookingId,
      holdTokenHash: "private",
      provider: "mock",
      providerPaymentId: paymentId,
      paymentCode: paymentId.replaceAll("-", ""),
      idempotencyKey: paymentId,
      totalAmount: "2000000",
      currency: "VND",
      status: "SUCCEEDED",
      paidAt: new Date("2031-12-01"),
    });
    await tx.insert(rentals).values({
      id: rentalId,
      bookingId,
      facilityId: fixture.facility,
      physicalUnitId: unitId,
      status: "RETURN_PENDING",
      startAt: new Date("2031-12-01"),
      expectedEndAt: new Date("2032-01-01T03:00:00Z"),
      depositAmount: "1000000",
    });
    await tx
      .insert(unitAssignments)
      .values({ bookingId, physicalUnitId: unitId, assignedBy: actorIds.staff });
    await tx.insert(capacityAllocations).values({
      facilityId: fixture.facility,
      unitTypeId: fixture.unitType,
      referenceId: bookingId,
      kind: "BOOKING",
      startsAt: new Date("2031-12-01"),
      endsAt: new Date("2032-01-01T03:00:00Z"),
    });
    await tx.insert(returnRequests).values({
      id: requestId,
      rentalId,
      facilityId: fixture.facility,
      slotId: fixture.slot,
      date,
      startsAt: new Date("2032-01-02T02:00:00Z"),
      endsAt: new Date("2032-01-02T03:30:00Z"),
      timezone: "Asia/Ho_Chi_Minh",
      status,
      assignedStaffId: actorIds.staff,
      reason: "Return test",
      createdBy: actorIds.owner,
    });
  });
  return { id: requestId, rentalId, unitId, bookingId, date };
}
async function start(id: string) {
  const current = await state(id);
  const response = await api("staff", "POST", `/return-requests/${id}/inspections`, {
    expectedVersion: current.request.version,
  });
  expect(response.statusCode).toBe(201);
  return response.json().data;
}
async function photo(id: string, inspection: { id: string; version: number }) {
  const response = await api(
    "staff",
    "POST",
    `/return-requests/${id}/inspections/${inspection.id}/photos`,
    {
      expectedVersion: inspection.version,
      filename: "proof.png",
      mimeType: "image/png",
      dataBase64: png,
    },
  );
  expect(response.statusCode).toBe(201);
  inspection.version++;
  return response.json().data.id as string;
}
async function save(
  id: string,
  inspection: { id: string; version: number },
  issue?: { code: string; photoId: string; additionalCode?: string },
) {
  const response = await api(
    "staff",
    "PUT",
    `/return-requests/${id}/inspections/${inspection.id}`,
    {
      expectedVersion: inspection.version,
      results: definition.map((item) => ({
        code: item.code,
        issue: [issue?.code, issue?.additionalCode].includes(item.code),
        note: [issue?.code, issue?.additionalCode].includes(item.code) ? "Observed issue" : "",
        photoIds: [issue?.code, issue?.additionalCode].includes(item.code) ? [issue.photoId] : [],
      })),
      propertyDisposition: "NONE",
      propertyReceiver: null,
      propertyHandledAt: null,
      propertyEvidencePhotoIds: [],
    },
  );
  expect(response.statusCode).toBe(200);
  inspection.version = response.json().data.version;
}
async function complete(id: string, inspection: { id: string; version: number }) {
  return api("staff", "POST", `/return-requests/${id}/inspections/${inspection.id}/complete`, {
    expectedVersion: inspection.version,
  });
}
async function receive(id: string, at = "2032-01-02T02:00:00Z") {
  const current = await state(id);
  const response = await api("staff", "POST", `/return-requests/${id}/physical-return`, {
    expectedVersion: current.request.version,
    actualReturnAt: at,
    reason: "Physical receipt",
  });
  expect(response.statusCode).toBe(200);
}

async function legacyRentEntitlement(requestId: string) {
  const [settlement] = await db
    .select()
    .from(returnSettlements)
    .where(eq(returnSettlements.requestId, requestId));
  if (!settlement) throw new Error("Missing legacy settlement fixture");
  // New settlements forbid unused-rent refunds; retain coverage of pre-policy history.
  const [legacy] = await db
    .update(returnSettlements)
    .set({
      unusedRentRefundAmount: "300000",
      refundEntitlement: String(BigInt(settlement.refundEntitlement) + 300000n),
    })
    .where(eq(returnSettlements.id, settlement.id))
    .returning();
  if (!legacy) throw new Error("Missing legacy entitlement");
  return legacy;
}

describe.skipIf(!target)(
  "return workflow with real local PostgreSQL and mocked private object storage",
  () => {
    beforeAll(async () => {
      assertTestDatabase(target, process.env);
      setSystemTime(new Date("2032-01-02T05:00:00Z"));
      const hash = await (await auth.$context).password.hash(password);
      setupStarted = true;
      await db.transaction(async (tx) => {
        for (const [key, role] of Object.entries(roles)) {
          const id = actorIds[key as keyof typeof roles];
          await tx.insert(users).values({
            id,
            role,
            name: "Return test",
            email: `${id}@example.test`,
            emailVerified: true,
            status: "ACTIVE",
          });
          await tx.insert(accounts).values({
            id: randomUUID(),
            userId: id,
            accountId: id,
            providerId: "credential",
            password: hash,
          });
        }
        await tx.insert(facilities).values([
          { id: fixture.facility, code: fixture.facility, name: "Return test", address: "Test" },
          {
            id: fixture.otherFacility,
            code: fixture.otherFacility,
            name: "Other return test",
            address: "Test",
          },
        ]);
        await tx
          .insert(systemSettings)
          .values([
            {
              key: "EXPIRY_REMINDER_DAYS",
              value: 7,
              description: "Expiry reminder test setting",
            },
            {
              key: "ABANDONED_REVIEW_DAYS",
              value: 7,
              description: "Abandoned review test setting",
            },
          ])
          .onConflictDoNothing();
        for (const [key, facilityId] of [
          ["staff", fixture.facility],
          ["replacement", fixture.facility],
          ["manager", fixture.facility],
          ["outsider", fixture.otherFacility],
        ] as const)
          await tx
            .insert(facilityAssignments)
            .values({ userId: actorIds[key], facilityId, role: roles[key] });
        await createTestUnitType(tx, {
          facilityId: fixture.facility,
          id: fixture.unitType,
          code: fixture.unitType,
          name: "Return test",
          sizeLabel: "S",
          lengthM: 1,
          widthM: 1,
          heightM: 1,
          monthlyPrice: 1000000,
        });

        await tx
          .insert(checkInSlots)
          .values({ id: fixture.slot, name: "Return test", startTime: "09:00", endTime: "10:30" });
        for (let day = 0; day < 7; day++)
          await tx.insert(facilityOperatingHours).values({
            facilityId: fixture.facility,
            dayOfWeek: day,
            openTime: "08:00",
            closeTime: "18:00",
            timezone: "Asia/Ho_Chi_Minh",
          });
        await tx.insert(facilityReturnCalendars).values({
          facilityId: fixture.facility,
          timezone: "Asia/Ho_Chi_Minh",
          holidays: ["2032-01-05"],
          reminderTime: "09:00",
          version: 1,
          updatedBy: actorIds.admin,
        });
      });
      app.decorate("db", db);
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);
      setupErrorHandler(app);
      await app.register(swaggerPlugin);
      await app.register(authPlugin);
      await app.register(authRoutes, { prefix: "/api/auth" });
      await app.register(facilitiesRoutes, { prefix: "/api/facilities" });
      await app.register(returnsRoutes, {
        prefix: "/api",
        photoStorage: {
          async upload() {
            const id = randomUUID();
            assets.add(id);
            return { publicId: id, format: "png" };
          },
          async remove(id: string) {
            assets.delete(id);
          },
          readUrl(id: string) {
            return `https://private.example.test/${id}`;
          },
        },
      });
      await app.register(lifecycleNotificationsRoutes, { prefix: "/api" });
      await app.register(rentalsRoutes, { prefix: "/api/rentals" });
      await app.register(rentalLifecycleSettingsRoutes, { prefix: "/api" });
      await app.ready();
      for (const key of Object.keys(roles) as (keyof typeof roles)[]) {
        const response = await api(null, "POST", "/auth/sign-in/email", {
          email: `${actorIds[key]}@example.test`,
          password,
        });
        expect(response.statusCode).toBe(200);
        cookies[key] = response.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      }
      const latest = await api("admin", "GET", "/return-policy/checklist");
      latestChecklistVersion = latest.json().data?.version ?? 0;
      const configured = await api("admin", "PUT", "/return-policy/checklist", {
        expectedVersion: latestChecklistVersion,
        items: definition,
      });
      expect(configured.statusCode).toBe(200);
      latestChecklistVersion++;
      const [rate] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "OVERDUE_FEE_RATE"));
      if (!rate) throw new Error("Seed return policy before running suite");
      initialRate = Number(rate.value);
      initialLifecycleSettings = await db
        .select()
        .from(systemSettings)
        .where(inArray(systemSettings.key, ["EXPIRY_REMINDER_DAYS", "ABANDONED_REVIEW_DAYS"]));
    });

    afterAll(async () => {
      setSystemTime();
      try {
        await app.close();
        if (!setupStarted) return;
        await db.transaction(async (tx) => {
          const requests = tx
            .select({ id: returnRequests.id })
            .from(returnRequests)
            .where(eq(returnRequests.facilityId, fixture.facility));
          const inspections = tx
            .select({ id: returnInspections.id })
            .from(returnInspections)
            .where(inArray(returnInspections.requestId, requests));
          await tx
            .delete(notificationOutbox)
            .where(eq(notificationOutbox.facilityId, fixture.facility));
          await tx.delete(returnAudit).where(inArray(returnAudit.actorId, Object.values(actorIds)));
          await tx
            .delete(systemSettingChanges)
            .where(inArray(systemSettingChanges.actorId, Object.values(actorIds)));
          for (const key of ["EXPIRY_REMINDER_DAYS", "ABANDONED_REVIEW_DAYS"] as const) {
            const original = initialLifecycleSettings.find((row) => row.key === key);
            if (original) {
              await tx.update(systemSettings).set(original).where(eq(systemSettings.key, key));
            } else {
              await tx.delete(systemSettings).where(eq(systemSettings.key, key));
            }
          }
          await tx.delete(returnRefunds).where(inArray(returnRefunds.requestId, requests));
          await tx.delete(returnTimeChanges).where(inArray(returnTimeChanges.requestId, requests));
          await tx
            .delete(returnEvidencePhotos)
            .where(inArray(returnEvidencePhotos.requestId, requests));
          await tx
            .delete(returnInspectionPhotos)
            .where(inArray(returnInspectionPhotos.inspectionId, inspections));
          await tx.delete(returnInspections).where(inArray(returnInspections.requestId, requests));
          const rentalIds = tx
            .select({ id: rentals.id })
            .from(rentals)
            .where(eq(rentals.facilityId, fixture.facility));
          const chargeIds = tx
            .select({ id: rentalCharges.id })
            .from(rentalCharges)
            .where(inArray(rentalCharges.rentalId, rentalIds));
          const chargePaymentIds = tx
            .select({ id: payments.id })
            .from(payments)
            .where(inArray(payments.rentalChargeId, chargeIds));
          await tx
            .delete(paymentProviderEvents)
            .where(inArray(paymentProviderEvents.paymentId, chargePaymentIds));
          await tx
            .delete(rentalChargeEvents)
            .where(inArray(rentalChargeEvents.chargeId, chargeIds));
          await tx
            .delete(rentalChargeAdjustments)
            .where(inArray(rentalChargeAdjustments.chargeId, chargeIds));
          await tx
            .delete(rentalChargeRefunds)
            .where(inArray(rentalChargeRefunds.chargeId, chargeIds));
          await tx.delete(returnSettlements).where(inArray(returnSettlements.requestId, requests));
          await tx.delete(returnRequests).where(eq(returnRequests.facilityId, fixture.facility));
          await tx.delete(payments).where(inArray(payments.id, chargePaymentIds));
          await tx.delete(rentalCharges).where(inArray(rentalCharges.id, chargeIds));
          const bookingIds = tx
            .select({ id: bookings.id })
            .from(bookings)
            .where(eq(bookings.facilityId, fixture.facility));
          await tx
            .delete(paymentProviderEvents)
            .where(
              inArray(
                paymentProviderEvents.paymentId,
                tx
                  .select({ id: payments.id })
                  .from(payments)
                  .where(inArray(payments.bookingId, bookingIds)),
              ),
            );
          await tx.delete(payments).where(inArray(payments.bookingId, bookingIds));
          await tx.delete(rentals).where(eq(rentals.facilityId, fixture.facility));
          await tx
            .delete(capacityAllocations)
            .where(eq(capacityAllocations.facilityId, fixture.facility));
          await tx.delete(bookings).where(eq(bookings.facilityId, fixture.facility));
          await tx.delete(storageUnits).where(eq(storageUnits.facilityId, fixture.facility));
          await tx
            .delete(facilityReturnCalendars)
            .where(eq(facilityReturnCalendars.facilityId, fixture.facility));
          await tx
            .delete(facilityOperatingHours)
            .where(eq(facilityOperatingHours.facilityId, fixture.facility));

          await tx
            .delete(facilityAssignments)
            .where(inArray(facilityAssignments.userId, Object.values(actorIds)));
          await tx
            .delete(returnChecklistVersions)
            .where(eq(returnChecklistVersions.createdBy, actorIds.admin));
          await deleteTestUnitTypes(tx, eq(unitTypes.id, fixture.unitType));
          await tx
            .delete(facilities)
            .where(inArray(facilities.id, [fixture.facility, fixture.otherFacility]));
          await tx.delete(checkInSlots).where(eq(checkInSlots.id, fixture.slot));
          await tx.delete(users).where(inArray(users.id, Object.values(actorIds)));
        });
      } finally {
        await queryClient.end();
      }
    });

    test("authorization is explicit: Admin config only, facility FM approval, assigned FS operations", async () => {
      const s = await scenario();
      const calendarPath = `/facilities/${fixture.facility}/return-calendar`;
      const calendar = await api("admin", "GET", calendarPath);
      expect(calendar.statusCode).toBe(200);
      expect(calendar.headers["cache-control"]).toBe("private, no-store");
      expect((await api(null, "GET", calendarPath)).statusCode).toBe(401);
      expect((await api("manager", "GET", calendarPath)).statusCode).toBe(403);
      const input = {
        expectedVersion: calendar.json().data.version + 1,
        timezone: calendar.json().data.timezone,
        holidays: calendar.json().data.holidays,
        reminderTime: calendar.json().data.reminderTime,
      };
      expect((await api("manager", "PUT", calendarPath, input)).statusCode).toBe(403);
      expect((await api("admin", "PUT", calendarPath, input)).statusCode).toBe(409);
      expect((await api(null, "GET", `/return-requests/${s.id}`)).statusCode).toBe(401);
      for (const who of ["admin", "bom", "outsider", "replacement"] as const)
        expect((await api(who, "GET", `/return-requests/${s.id}`)).statusCode).toBe(403);
      expect((await api("other", "GET", `/return-requests/${s.id}`)).statusCode).toBe(404);
      expect((await api("owner", "GET", `/return-requests/${s.id}`)).statusCode).toBe(200);
      expect(
        (
          await api("manager", "PUT", "/return-policy/checklist", {
            expectedVersion: latestChecklistVersion,
            items: definition,
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (await api("admin", "PUT", "/return-policy/overdue-rate", { expectedVersion: 0, rate: 30 }))
          .statusCode,
      ).toBe(403);
      expect(
        (
          await api("staff", "POST", `/return-requests/${s.id}/settlement`, {
            expectedVersion: 0,
            damageAmount: "0",
            unusedRentRefundAmount: "0",
            reason: "Test",
          })
        ).statusCode,
      ).toBe(403);
    });

    test("lifecycle settings are System Admin-only, versioned and audited atomically", async () => {
      const denied = await api("manager", "GET", "/return-policy/lifecycle-settings");
      expect(denied.statusCode).toBe(403);
      const listed = await api("admin", "GET", "/return-policy/lifecycle-settings");
      expect(listed.statusCode).toBe(200);
      expect(listed.json().data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: "EXPIRY_REMINDER_DAYS", value: expect.any(Number) }),
          expect.objectContaining({ key: "ABANDONED_REVIEW_DAYS", value: expect.any(Number) }),
        ]),
      );
      const setting = listed
        .json()
        .data.find((row: { key: string }) => row.key === "EXPIRY_REMINDER_DAYS");
      const changed = await api("admin", "PUT", "/return-policy/lifecycle-settings", {
        key: setting.key,
        value: 0,
        expectedVersion: setting.version,
      });
      expect(changed.statusCode).toBe(200);
      expect(changed.json().data).toMatchObject({ value: 0, version: setting.version + 1 });
      expect(
        (
          await api("admin", "PUT", "/return-policy/lifecycle-settings", {
            key: setting.key,
            value: 7,
            expectedVersion: setting.version,
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await api("admin", "PUT", "/return-policy/lifecycle-settings", {
            key: setting.key,
            value: -1,
            expectedVersion: setting.version + 1,
          })
        ).statusCode,
      ).toBe(400);
      const restored = await api("admin", "PUT", "/return-policy/lifecycle-settings", {
        key: setting.key,
        value: setting.value,
        expectedVersion: setting.version + 1,
      });
      expect(restored.statusCode).toBe(200);
      const audit = await db
        .select()
        .from(returnAudit)
        .where(
          and(
            eq(returnAudit.actorId, actorIds.admin),
            eq(returnAudit.action, "RENTAL_LIFECYCLE_SETTING_CONFIGURED"),
          ),
        );
      expect(audit).toHaveLength(2);
      expect(audit.map((row) => row.details)).toEqual(
        expect.arrayContaining([
          {
            key: setting.key,
            before: { value: setting.value, version: setting.version },
            after: { value: 0, version: setting.version + 1 },
          },
          {
            key: setting.key,
            before: { value: 0, version: setting.version + 1 },
            after: { value: setting.value, version: setting.version + 2 },
          },
        ]),
      );
    });

    test("pending does not reserve; concurrent confirmation enforces capacity and buffer", async () => {
      const a = await scenario("PENDING"),
        b = await scenario("PENDING");
      for (const item of [a, b])
        await db.delete(returnRequests).where(eq(returnRequests.id, item.id));
      const body = { date: "2032-01-04", slotId: fixture.slot, reason: "Customer scheduling" };
      const creations = await Promise.all(
        [a, b].map((item) =>
          api("owner", "POST", `/rentals/${item.rentalId}/return-requests`, body),
        ),
      );
      expect(creations.map((r) => r.statusCode)).toEqual([201, 201]);
      const requests = creations.map((r) => r.json().data);
      const dup = await api("owner", "POST", `/rentals/${a.rentalId}/return-requests`, body);
      expect(dup.statusCode).toBe(409);
      for (const request of requests) {
        const assigned = await api("manager", "PATCH", `/return-requests/${request.id}/staff`, {
          expectedVersion: request.version,
          staffId: actorIds.staff,
          reason: "Assign staff",
        });
        expect(assigned.statusCode).toBe(200);
        request.version = assigned.json().data.version;
      }
      const confirmations = await Promise.all(
        requests.map((r) =>
          api("staff", "POST", `/return-requests/${r.id}/confirm`, { expectedVersion: r.version }),
        ),
      );
      expect(confirmations.map((r) => r.statusCode).sort()).toEqual([200, 409]);
      const winner = confirmations.find((r) => r.statusCode === 200)?.json().data;
      expect(
        (
          await api("owner", "POST", `/return-requests/${winner.id}/cancel`, {
            expectedVersion: winner.version,
          })
        ).statusCode,
      ).toBe(409);
      const available = await api(
        "owner",
        "GET",
        `/rentals/${b.rentalId}/return-slots?date=2032-01-04`,
      );
      expect(available.statusCode).toBe(200);
      expect(
        available
          .json()
          .data.every(
            (slot: { startsAt: string }) =>
              !["2032-01-04T02:00:00.000Z", "2032-01-04T03:30:00.000Z"].includes(slot.startsAt),
          ),
      ).toBe(true);
      const loser = requests.find((r) => r.id !== winner.id);
      expect(
        (
          await api("owner", "POST", `/return-requests/${loser.id}/cancel`, {
            expectedVersion: loser.version,
          })
        ).statusCode,
      ).toBe(200);
      // Admin edits preserve confirmed appointment snapshots and flag manual follow-up.
      const updated = await api("admin", "PUT", `/facilities/${fixture.facility}/return-calendar`, {
        expectedVersion: 1,
        timezone: "Asia/Ho_Chi_Minh",
        holidays: ["2032-01-05", "2032-01-04"],
        reminderTime: "09:00",
      });
      expect(updated.statusCode).toBe(200);
      const retained = await state(winner.id);
      expect(retained.request.startsAt).toBe(winner.startsAt);
      expect(retained.request.status).toBe("CONFIRMED");
      expect(retained.request.manualReviewRequired).toBe(true);
    });

    test("customer create/edit enforce notice, holidays, ownership and pending-only changes", async () => {
      const item = await scenario("PENDING");
      await db.delete(returnRequests).where(eq(returnRequests.id, item.id));
      const path = `/rentals/${item.rentalId}/return-requests`;
      expect(
        (
          await api("other", "POST", path, {
            date: "2032-01-06",
            slotId: fixture.slot,
            reason: "test",
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await api("owner", "POST", path, {
            date: "2032-01-03",
            slotId: fixture.slot,
            reason: "test",
          })
        ).statusCode,
      ).toBe(422);
      expect(
        (
          await api("owner", "POST", path, {
            date: "2032-01-05",
            slotId: fixture.slot,
            reason: "test",
          })
        ).statusCode,
      ).toBe(409);
      const created = await api("owner", "POST", path, {
        date: "2032-01-06",
        slotId: fixture.slot,
        reason: "test",
      });
      expect(created.statusCode).toBe(201);
      const request = created.json().data;
      expect(
        (
          await api("owner", "PATCH", `/return-requests/${request.id}`, {
            expectedVersion: request.version,
            date: "2032-01-03",
            slotId: fixture.slot,
            reason: "edit",
          })
        ).statusCode,
      ).toBe(422);
      const cancelled = await api("owner", "POST", `/return-requests/${request.id}/cancel`, {
        expectedVersion: request.version,
      });
      expect(cancelled.statusCode).toBe(200);
      expect(
        (await db.select().from(rentals).where(eq(rentals.id, item.rentalId)))[0]?.status,
      ).toBe("OVERDUE");
    });

    test("exactly 24 hours notice is allowed, one millisecond less is rejected on edit", async () => {
      const item = await scenario("PENDING");
      await db.delete(returnRequests).where(eq(returnRequests.id, item.id));
      try {
        setSystemTime(new Date("2032-01-02T02:00:00Z"));
        const body = { date: "2032-01-03", slotId: fixture.slot, reason: "24-hour boundary" };
        const creates = await Promise.all(
          [1, 2].map(() => api("owner", "POST", `/rentals/${item.rentalId}/return-requests`, body)),
        );
        expect(creates.map((r) => r.statusCode).sort()).toEqual([201, 409]);
        const created = creates.find((r) => r.statusCode === 201)?.json().data;
        setSystemTime(new Date("2032-01-02T02:00:00.001Z"));
        expect(
          (
            await api("owner", "PATCH", `/return-requests/${created.id}`, {
              ...body,
              expectedVersion: created.version,
            })
          ).statusCode,
        ).toBe(422);
      } finally {
        setSystemTime(new Date("2032-01-02T05:00:00Z"));
      }
    });

    test("operational context preserves guest bookings and restricts staff/contact visibility", async () => {
      const item = await scenario();
      const bookingCode = `RETURN-${item.id}`;
      await db.update(bookings).set({ bookingCode }).where(eq(bookings.id, item.bookingId));
      const detail = await state(item.id);
      expect(detail.context).toMatchObject({
        booking: { id: item.bookingId, bookingCode },
        customer: { id: actorIds.owner, name: "Return test", phone: "0900000000" },
        rental: { id: item.rentalId, status: "RETURN_PENDING", depositSnapshot: "1000000" },
        unit: { id: item.unitId, code: item.unitId },
        facility: { id: fixture.facility },
        assignedStaff: { id: actorIds.staff, name: "Return test" },
      });
      expect(Object.keys(detail.context.customer).sort()).toEqual(["id", "name", "phone"]);
      const staff = await api("staff", "GET", `/return-requests/${item.id}`);
      expect(staff.json().data.context).toEqual(detail.context);
      expect((await api("replacement", "GET", `/return-requests/${item.id}`)).statusCode).toBe(403);
      expect((await api("outsider", "GET", `/return-requests/${item.id}`)).statusCode).toBe(403);
      expect(
        (await api("owner", "GET", `/return-requests/${item.id}`)).json().data.context,
      ).toBeNull();
      await db.update(bookings).set({ userId: null }).where(eq(bookings.id, item.bookingId));
      await db
        .update(returnRequests)
        .set({ assignedStaffId: null })
        .where(eq(returnRequests.id, item.id));
      const queue = await api(
        "manager",
        "GET",
        `/facilities/${fixture.facility}/return-requests?limit=100&fromDate=${item.date}`,
      );
      const row = queue.json().data.find((r: { id: string }) => r.id === item.id);
      expect(row.context.customer.id).toBeNull();
      expect(row.context.assignedStaff).toBeNull();
      expect(row.context.unit.unitTypeName).toBeString();
      expect(row.context.unit.sizeLabel).toBeString();
    });

    test("settlement preview is authorized, versioned and read-only; mutation recalculates", async () => {
      const item = await scenario();
      const path = `/return-requests/${item.id}/settlement/preview`;
      const input = {
        expectedVersion: 0,
        damageAmount: "0",
        unusedRentRefundAmount: "0",
        reason: "Preview",
      };
      expect((await api(null, "POST", path, input)).statusCode).toBe(401);
      for (const role of ["staff", "outsider", "owner", "admin", "bom"] as const)
        expect((await api(role, "POST", path, input)).statusCode).toBe(403);
      const beforeBlocked = await state(item.id);
      const blocked = await api("manager", "POST", path, input);
      expect(await state(item.id)).toEqual(beforeBlocked);
      expect(blocked.statusCode).toBe(200);
      expect(blocked.json().data).toMatchObject({ canClose: false, calculation: null });
      expect(blocked.json().data.blockingReasons.map((b: { code: string }) => b.code)).toContain(
        "ACTUAL_RETURN_MISSING",
      );
      const inspection = await start(item.id);
      await save(item.id, inspection);
      await complete(item.id, inspection);
      await receive(item.id);
      input.expectedVersion = (await state(item.id)).request.version;
      const snapshot = async () => ({
        detail: await state(item.id),
        rental: await db.select().from(rentals).where(eq(rentals.id, item.rentalId)),
        unit: await db.select().from(storageUnits).where(eq(storageUnits.id, item.unitId)),
        assignments: await db
          .select()
          .from(unitAssignments)
          .where(eq(unitAssignments.bookingId, item.bookingId)),
        capacity: await db
          .select()
          .from(capacityAllocations)
          .where(eq(capacityAllocations.referenceId, item.bookingId)),
        outbox: await db.select().from(notificationOutbox),
      });
      const [calendar] = await db
        .select()
        .from(facilityReturnCalendars)
        .where(eq(facilityReturnCalendars.facilityId, fixture.facility));
      if (!calendar) throw new Error("Missing test calendar");
      await db
        .delete(facilityReturnCalendars)
        .where(eq(facilityReturnCalendars.facilityId, fixture.facility));
      try {
        const missing = await api("manager", "POST", path, input);
        expect(missing.json().data).toMatchObject({ canClose: false, calculation: null });
        expect(missing.json().data.blockingReasons.map((b: { code: string }) => b.code)).toContain(
          "CONFIGURATION_MISSING",
        );
      } finally {
        await db.insert(facilityReturnCalendars).values(calendar);
      }
      const before = await snapshot();
      const preview = await api("manager", "POST", path, input);
      expect(preview.statusCode).toBe(200);
      expect(preview.json().data).toMatchObject({
        requestId: item.id,
        version: input.expectedVersion,
        canClose: true,
        blockingReasons: [],
      });
      expect(preview.json().data.calculation).toMatchObject({
        depositSnapshot: "1000000",
        rateSnapshot: initialRate,
        remainingRentRefund: "0",
        confirmedDepositRefund: "0",
        confirmedRentRefund: "0",
        allocationKnown: true,
      });
      expect(await snapshot()).toEqual(before);
      expect(
        (
          await api("manager", "POST", path, {
            ...input,
            expectedVersion: input.expectedVersion - 1,
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (await api("manager", "POST", path, { ...input, damageAmount: "1.5" })).statusCode,
      ).toBe(400);
      expect(
        (await api("manager", "POST", path, { ...input, unusedRentRefundAmount: "1000001" }))
          .statusCode,
      ).toBe(400);
      const damage = await api("manager", "POST", path, { ...input, damageAmount: "1" });
      expect(damage.json().data.canClose).toBe(false);
      expect(damage.json().data.blockingReasons.map((b: { code: string }) => b.code)).toContain(
        "DAMAGE_EVIDENCE_MISSING",
      );
      const [originalRate] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "OVERDUE_FEE_RATE"));
      if (!originalRate) throw new Error("Missing test rate");
      const assigned = await api("manager", "PATCH", `/return-requests/${item.id}/staff`, {
        expectedVersion: input.expectedVersion,
        staffId: actorIds.staff,
        reason: "Revalidate after preview",
      });
      expect(assigned.statusCode).toBe(200);
      expect(
        (await api("manager", "POST", `/return-requests/${item.id}/settlement`, input)).statusCode,
      ).toBe(409);
      input.expectedVersion = (await state(item.id)).request.version;
      await db
        .update(systemSettings)
        .set({ value: 50 })
        .where(eq(systemSettings.key, "OVERDUE_FEE_RATE"));
      try {
        const settled = await api(
          "manager",
          "POST",
          `/return-requests/${item.id}/settlement`,
          input,
        );
        expect(settled.statusCode).toBe(200);
        expect(settled.json().data.rateSnapshot).toBe(50);
        expect(settled.json().data.refundEntitlement).toBe("500000");
        expect((await state(item.id)).refundSummary.remainingRefund).toBe("500000");
      } finally {
        await db
          .update(systemSettings)
          .set(originalRate)
          .where(eq(systemSettings.key, "OVERDUE_FEE_RATE"));
      }
      expect((await api("manager", "POST", path, input)).statusCode).toBe(409);
    });

    test("return OpenAPI documents full operational and financial response contracts", () => {
      const paths = app.swagger().paths;
      for (const [path, method] of [
        ["/api/facilities/{facilityId}/return-requests", "get"],
        ["/api/return-requests/{requestId}", "get"],
        ["/api/return-requests/{requestId}/settlement/preview", "post"],
        ["/api/return-requests/{requestId}/settlement", "post"],
        ["/api/return-requests/{requestId}/refunds/confirm", "post"],
      ] as const) {
        const response = paths?.[path]?.[method]?.responses?.["200"];
        expect(JSON.stringify(response)).toContain('"properties"');
        expect(JSON.stringify(response)).toContain('"data"');
      }
      expect(JSON.stringify(paths?.["/api/return-requests/{requestId}"])).toContain(
        "refundSummary",
      );
    });

    test("facility queues enforce scope and assignment, rental request listing enforces ownership", async () => {
      const item = await scenario();
      const queuePath = `/facilities/${fixture.facility}/return-requests?limit=100&offset=0&fromDate=${item.date}`;
      expect((await api("outsider", "GET", queuePath)).statusCode).toBe(403);
      expect((await api("admin", "GET", queuePath)).statusCode).toBe(403);
      const fm = await api("manager", "GET", queuePath);
      expect(fm.statusCode).toBe(200);
      expect(fm.headers["cache-control"]).toBe("private, no-store");
      expect(fm.json().data.some((r: { id: string }) => r.id === item.id)).toBe(true);
      const unassigned = await api("replacement", "GET", queuePath);
      expect(unassigned.statusCode).toBe(200);
      expect(unassigned.json().data.some((r: { id: string }) => r.id === item.id)).toBe(false);
      expect(
        (await api("other", "GET", `/rentals/${item.rentalId}/return-requests`)).statusCode,
      ).toBe(404);
      const owned = await api("owner", "GET", `/rentals/${item.rentalId}/return-requests`);
      expect(owned.statusCode).toBe(200);
      expect(owned.json().data.map((r: { id: string }) => r.id)).toEqual([item.id]);
    });

    test("unresolved property survives a failed attempt and blocks closure until its recorded disposition", async () => {
      const item = await scenario();
      const first = await start(item.id);
      const proof = await photo(item.id, first);
      await save(item.id, first, { code: "UNIT", additionalCode: "PROPERTY", photoId: proof });
      expect((await complete(item.id, first)).json().data.status).toBe("FAIL");
      const second = await start(item.id);
      const handoffProof = await photo(item.id, second);
      await save(item.id, second);
      expect((await complete(item.id, second)).json().data.status).toBe("PASS");
      await receive(item.id);
      const settlement = async () =>
        api("manager", "POST", `/return-requests/${item.id}/settlement`, {
          expectedVersion: (await state(item.id)).request.version,
          damageAmount: "0",
          unusedRentRefundAmount: "0",
          reason: "Approved",
        });
      expect((await settlement()).statusCode).toBe(409);
      const old = (await state(item.id)).inspections.find((i: { id: string }) => i.id === first.id);
      const foreign = await scenario();
      const foreignAttempt = await start(foreign.id);
      const foreignPhoto = await photo(foreign.id, foreignAttempt);
      expect(
        (
          await api(
            "staff",
            "PUT",
            `/return-requests/${item.id}/inspections/${first.id}/property`,
            {
              expectedVersion: old.version,
              propertyDisposition: "STORED",
              propertyReceiver: "Custody receiver",
              propertyHandledAt: "2032-01-02T04:00:00Z",
              propertyEvidencePhotoIds: [foreignPhoto],
            },
          )
        ).statusCode,
      ).toBe(422);
      const handled = await api(
        "staff",
        "PUT",
        `/return-requests/${item.id}/inspections/${first.id}/property`,
        {
          expectedVersion: old.version,
          propertyDisposition: "STORED",
          propertyReceiver: "Custody receiver",
          propertyHandledAt: "2032-01-02T04:00:00Z",
          propertyEvidencePhotoIds: [handoffProof],
        },
      );
      expect(handled.statusCode).toBe(200);
      expect(handled.json().data.status).toBe("FAIL");
      expect((await settlement()).statusCode).toBe(200);
    });

    test("unknown commit outcomes retain referenced inspection and supplemental evidence photos", async () => {
      const item = await scenario();
      const inspection = await start(item.id);
      const storage = {
        async upload() {
          const id = randomUUID();
          assets.add(id);
          return { publicId: id, format: "png" };
        },
        async remove(id: string) {
          assets.delete(id);
        },
        readUrl(id: string) {
          return id;
        },
      };
      const repository = new ReturnsRepository(db);
      const service = new ReturnsService(repository, storage);
      const locked = repository.lockedRequest.bind(repository);
      let calls = 0;
      const spy = spyOn(repository, "lockedRequest").mockImplementation(async (...args) => {
        const result = await locked(...args);
        if (++calls === 2) throw new Error("Lost COMMIT acknowledgement");
        return result;
      });
      try {
        await expect(
          service.uploadPhoto(
            { id: actorIds.staff, role: "FACILITY_STAFF" },
            item.id,
            inspection.id,
            {
              expectedVersion: inspection.version,
              filename: "proof.png",
              mimeType: "image/png",
              dataBase64: png,
            },
          ),
        ).rejects.toThrow("Lost COMMIT acknowledgement");
        const [row] = await db
          .select()
          .from(returnInspectionPhotos)
          .where(eq(returnInspectionPhotos.inspectionId, inspection.id));
        expect(row).toBeDefined();
        expect(assets.has(row?.publicId ?? "")).toBe(true);
        calls = 0;
        await expect(
          service.uploadEvidence({ id: actorIds.staff, role: "FACILITY_STAFF" }, item.id, {
            expectedVersion: (await state(item.id)).request.version,
            purpose: "TIME_CORRECTION",
            filename: "receipt.png",
            mimeType: "image/png",
            dataBase64: png,
          }),
        ).rejects.toThrow("Lost COMMIT acknowledgement");
        const [evidence] = await db
          .select()
          .from(returnEvidencePhotos)
          .where(eq(returnEvidencePhotos.requestId, item.id));
        expect(evidence).toBeDefined();
        expect(assets.has(evidence?.publicId ?? "")).toBe(true);
      } finally {
        spy.mockRestore();
      }
    });

    test("failure retry creates a new inspection and snapshots configurable severity", async () => {
      const s = await scenario();
      const first = await start(s.id);
      const proof = await photo(s.id, first);
      await save(s.id, first, { code: "UNIT", photoId: proof });
      const configured = await api("admin", "PUT", "/return-policy/checklist", {
        expectedVersion: latestChecklistVersion,
        items: definition.map((i) => (i.code === "UNIT" ? { ...i, serious: false } : i)),
      });
      expect(configured.statusCode).toBe(200);
      latestChecklistVersion++;
      const failed = await complete(s.id, first);
      expect(failed.statusCode).toBe(200);
      expect(failed.json().data.status).toBe("FAIL");
      expect((await state(s.id)).request.status).toBe("FAILED");
      expect(
        (await db.select().from(storageUnits).where(eq(storageUnits.id, s.unitId)))[0]?.status,
      ).toBe("MAINTENANCE");
      const second = await start(s.id);
      expect(second.id).not.toBe(first.id);
      expect(second.attempt).toBe(2);
      expect(second.definition.find((i: { code: string }) => i.code === "UNIT").serious).toBe(
        false,
      );
      expect(
        (await state(s.id)).inspections.find((i: { id: string }) => i.id === first.id).status,
      ).toBe("FAIL");
      const stale = await api("staff", "PUT", `/return-requests/${s.id}/inspections/${first.id}`, {
        expectedVersion: first.version,
        results: [],
        propertyDisposition: "NONE",
        propertyReceiver: null,
        propertyHandledAt: null,
        propertyEvidencePhotoIds: [],
      });
      expect(stale.statusCode).toBe(404);
    });

    test("photo cap and stale versions survive concurrent uploads; FM reassignment revokes the previous FS", async () => {
      const item = await scenario();
      const inspection = await start(item.id);
      for (let n = 0; n < 4; n++) await photo(item.id, inspection);
      const before = assets.size;
      const upload = () =>
        api("staff", "POST", `/return-requests/${item.id}/inspections/${inspection.id}/photos`, {
          expectedVersion: inspection.version,
          filename: "proof.png",
          mimeType: "image/png",
          dataBase64: png,
        });
      const results = await Promise.all([upload(), upload()]);
      expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
      expect(assets.size).toBe(before + 1);
      expect(
        await db
          .select()
          .from(returnInspectionPhotos)
          .where(eq(returnInspectionPhotos.inspectionId, inspection.id)),
      ).toHaveLength(5);
      const current = await state(item.id);
      inspection.version = current.inspections[0].version;
      expect((await upload()).statusCode).toBe(409);
      const reassigned = await api("manager", "PATCH", `/return-requests/${item.id}/staff`, {
        expectedVersion: current.request.version,
        staffId: actorIds.replacement,
        reason: "Shift change",
      });
      expect(reassigned.statusCode).toBe(200);
      expect((await api("staff", "GET", `/return-requests/${item.id}`)).statusCode).toBe(403);
      expect((await api("replacement", "GET", `/return-requests/${item.id}`)).statusCode).toBe(200);
    });

    test("property/evidence and physical receipt gate closure; settlement starts the three-business-day SLA", async () => {
      const s = await scenario();
      const inspection = await start(s.id);
      const proof = await photo(s.id, inspection);
      await save(s.id, inspection, { code: "PROPERTY", additionalCode: "UNIT", photoId: proof });
      expect((await complete(s.id, inspection)).json().data.status).toBe("PASS");
      let current = await state(s.id);
      const settle = () =>
        api("manager", "POST", `/return-requests/${s.id}/settlement`, {
          expectedVersion: current.request.version,
          damageAmount: "100000",
          unusedRentRefundAmount: "0",
          reason: "Approved damage",
        });
      expect((await settle()).statusCode).toBe(409);
      const propertyPreview = await api(
        "manager",
        "POST",
        `/return-requests/${s.id}/settlement/preview`,
        {
          expectedVersion: current.request.version,
          damageAmount: "100000",
          unusedRentRefundAmount: "0",
          reason: "Preview property",
        },
      );
      expect(
        propertyPreview.json().data.blockingReasons.map((b: { code: string }) => b.code),
      ).toEqual(expect.arrayContaining(["PROPERTY_UNRESOLVED", "ACTUAL_RETURN_MISSING"]));
      await receive(s.id);
      current = await state(s.id);
      expect((await settle()).statusCode).toBe(409);
      const handoff = await api(
        "staff",
        "PUT",
        `/return-requests/${s.id}/inspections/${inspection.id}/property`,
        {
          expectedVersion: current.inspections[0].version,
          propertyDisposition: "STORED",
          propertyReceiver: "Custody department recipient",
          propertyHandledAt: "2032-01-02T03:00:00Z",
          propertyEvidencePhotoIds: [proof],
        },
      );
      expect(handoff.statusCode).toBe(200);
      current = await state(s.id);
      const results = await Promise.all([settle(), settle()]);
      expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
      expect(results[0].json().data.id).toBe(results[1].json().data.id);
      const amount = String(1000000 - initialRate * 10000 - 100000);
      expect(results[0].json().data.refundEntitlement).toBe(amount);
      expect(results[0].json().data.refundDueDate).toBe("2032-01-08");
      current = await state(s.id);
      expect(current.settlements).toHaveLength(1);
      expect(current.request.status).toBe("COMPLETED");
      expect(
        (
          await db.select().from(unitAssignments).where(eq(unitAssignments.bookingId, s.bookingId))
        )[0]?.status,
      ).toBe("COMPLETED");
      expect(
        (
          await db
            .select()
            .from(capacityAllocations)
            .where(eq(capacityAllocations.referenceId, s.bookingId))
        )[0]?.status,
      ).toBe("RELEASED");
      expect((await db.select().from(rentals).where(eq(rentals.id, s.rentalId)))[0]?.status).toBe(
        "CLOSED",
      );
      expect(
        (await db.select().from(storageUnits).where(eq(storageUnits.id, s.unitId)))[0]?.status,
      ).toBe("AVAILABLE");
    });

    test("post-settlement corrections require FM and append revisions; original snapshots and refunds remain intact", async () => {
      const s = await scenario();
      const inspection = await start(s.id);
      await save(s.id, inspection);
      expect((await complete(s.id, inspection)).statusCode).toBe(200);
      await receive(s.id);
      let current = await state(s.id);
      expect(
        (
          await api("manager", "POST", `/return-requests/${s.id}/settlement`, {
            expectedVersion: current.request.version,
            damageAmount: "0",
            unusedRentRefundAmount: "0",
            reason: "Approved",
          })
        ).statusCode,
      ).toBe(200);
      current = await state(s.id);
      const original = current.settlements[0];
      const evidence = await api("staff", "POST", `/return-requests/${s.id}/evidence`, {
        expectedVersion: current.request.version,
        purpose: "TIME_CORRECTION",
        filename: "receipt.png",
        mimeType: "image/png",
        dataBase64: png,
      });
      expect(evidence.statusCode).toBe(201);
      current = await state(s.id);
      const input = {
        expectedVersion: current.request.version,
        actualReturnAt: "2032-01-01T16:59:00Z",
        reason: "Receipt entry was late",
        evidencePhotoIds: [evidence.json().data.id],
        idempotencyKey: randomUUID(),
      };
      const proposal = await api("staff", "POST", `/return-requests/${s.id}/time-changes`, input);
      expect(proposal.statusCode).toBe(201);
      expect(
        (await api("staff", "POST", `/return-requests/${s.id}/time-changes`, input)).json().data.id,
      ).toBe(proposal.json().data.id);
      current = await state(s.id);
      expect(current.settlements).toHaveLength(1);
      const decision = {
        expectedVersion: current.request.version,
        approve: true,
        reason: "Evidence verified",
      };
      const path = `/return-requests/${s.id}/time-changes/${proposal.json().data.id}/decision`;
      expect((await api("staff", "POST", path, decision)).statusCode).toBe(403);
      const approved = await Promise.all([
        api("manager", "POST", path, decision),
        api("manager", "POST", path, decision),
      ]);
      expect(approved.map((r) => r.statusCode)).toEqual([200, 200]);
      current = await state(s.id);
      expect(current.settlements).toHaveLength(2);
      expect(current.settlements[1].id).toBe(original.id);
      expect(current.settlements[1].overdueFeeAmount).toBe(original.overdueFeeAmount);
      expect(current.settlements[0].overdueFeeAmount).toBe("0");
      expect(current.settlements[0].refundEntitlement).toBe("1000000");
      expect(current.settlements[0].rateSnapshot).toBe(original.rateSnapshot);
      expect(
        current.audit.some((a: { action: string }) => a.action === "SETTLEMENT_ADJUSTED"),
      ).toBe(true);
    });
    test("open rental occupancy survives RETURN_PENDING and OVERDUE in handover and assignment guards", async () => {
      const item = await scenario();
      await db
        .update(storageUnits)
        .set({ status: "AVAILABLE" })
        .where(eq(storageUnits.id, item.unitId));
      for (const status of ["RETURN_PENDING", "OVERDUE"] as const) {
        await db.update(rentals).set({ status }).where(eq(rentals.id, item.rentalId));
        await db.transaction(async (tx) => {
          expect((await new InspectionsRepository(db).activeRental(tx, item.unitId))?.id).toBe(
            item.rentalId,
          );
        });
        const eligible = await new BookingsRepository(db).findEligibleUnits(
          fixture.facility,
          fixture.unitType,
          item.bookingId,
          new Date("2032-01-02"),
          new Date("2032-02-02"),
        );
        expect(eligible.find((unit) => unit.id === item.unitId)?.isAvailableForPeriod).toBe(false);
      }
    });

    test("BOM rate changes are audited and do not recalculate assessed snapshots; transaction failure rolls back all settlement effects", async () => {
      const item = await scenario();
      const inspection = await start(item.id);
      await save(item.id, inspection);
      await complete(item.id, inspection);
      await receive(item.id);
      const current = await state(item.id);
      const rollback = new Error("Rollback fixture-only configuration transaction");
      try {
        await db.transaction(async (tx) => {
          const service = new ReturnsService(new ReturnsRepository(tx as unknown as Database));
          const actor = { id: actorIds.bom, role: roles.bom };
          const policy = await service.rate(actor);
          await service.configureRate(actor, { expectedVersion: policy.version, rate: 31 });
          const input = {
            expectedVersion: current.request.version,
            damageAmount: "0",
            unusedRentRefundAmount: "0",
            reason: "Approved",
          };
          const first = await service.settle(
            { id: actorIds.manager, role: roles.manager },
            item.id,
            input,
          );
          expect(first.overdueFeeAmount).toBe("310000");
          const changed = await service.rate(actor);
          await service.configureRate(actor, { expectedVersion: changed.version, rate: 0 });
          const retry = await service.settle(
            { id: actorIds.manager, role: roles.manager },
            item.id,
            input,
          );
          expect(retry.id).toBe(first.id);
          expect(retry.rateSnapshot).toBe(31);
          expect(retry.overdueFeeAmount).toBe("310000");
          const audits = await tx
            .select()
            .from(returnAudit)
            .where(eq(returnAudit.actorId, actorIds.bom));
          expect(audits).toHaveLength(2);
          throw rollback;
        });
      } catch (error) {
        expect(error).toBe(rollback);
      }
      const after = await state(item.id);
      expect(after.request.status).toBe("INSPECTING");
      expect(after.settlements).toHaveLength(0);
      expect(
        (await db.select().from(rentals).where(eq(rentals.id, item.rentalId)))[0]?.closedAt,
      ).toBeNull();
      expect(
        (
          await db
            .select()
            .from(unitAssignments)
            .where(eq(unitAssignments.bookingId, item.bookingId))
        )[0]?.status,
      ).toBe("ACTIVE");
      expect((await api("bom", "GET", "/return-policy/overdue-rate")).json().data.rate).toBe(
        initialRate,
      );
    });

    test("approved receivables exceeding deposit produce debt and zero refund without collection", async () => {
      const item = await scenario();
      const inspection = await start(item.id);
      const evidence = await photo(item.id, inspection);
      await save(item.id, inspection, { code: "UNIT", photoId: evidence });
      await complete(item.id, inspection);
      await receive(item.id);
      const current = await state(item.id);
      const settled = await api("manager", "POST", `/return-requests/${item.id}/settlement`, {
        expectedVersion: current.request.version,
        damageAmount: "1500000",
        unusedRentRefundAmount: "0",
        reason: "Approved evidence and fees",
      });
      expect(settled.statusCode).toBe(200);
      expect(settled.json().data.refundEntitlement).toBe("0");
      expect(settled.json().data.debtAmount).toBe(String(500000 + initialRate * 10000));
      expect((await state(item.id)).refunds).toHaveLength(0);
    });

    test("manual refund requires FM proof, stores a separate transaction and deduplicates retries", async () => {
      const item = await scenario();
      const inspection = await start(item.id);
      await save(item.id, inspection);
      await complete(item.id, inspection);
      await receive(item.id);
      let current = await state(item.id);
      const settled = await api("manager", "POST", `/return-requests/${item.id}/settlement`, {
        expectedVersion: current.request.version,
        damageAmount: "0",
        unusedRentRefundAmount: "0",
        reason: "Approved",
      });
      expect(settled.statusCode).toBe(200);
      current = await state(item.id);
      const proof = await api("manager", "POST", `/return-requests/${item.id}/evidence`, {
        expectedVersion: current.request.version,
        purpose: "REFUND",
        filename: "receipt.png",
        mimeType: "image/png",
        dataBase64: png,
      });
      expect(proof.statusCode).toBe(201);
      current = await state(item.id);
      const input = {
        expectedVersion: current.request.version,
        amount: settled.json().data.refundEntitlement,
        reference: randomUUID(),
        evidencePhotoIds: [proof.json().data.id],
        idempotencyKey: randomUUID(),
      };
      expect(
        (await api("staff", "POST", `/return-requests/${item.id}/refunds/confirm`, input))
          .statusCode,
      ).toBe(403);
      const confirmed = await Promise.all(
        [1, 2].map(() =>
          api("manager", "POST", `/return-requests/${item.id}/refunds/confirm`, input),
        ),
      );
      expect(confirmed.map((r) => r.statusCode)).toEqual([200, 200]);
      expect(confirmed[0].json().data.id).toBe(confirmed[1].json().data.id);
      current = await state(item.id);
      expect(current.refunds).toHaveLength(1);
      expect(current.settlements[0].remainingRefund).toBe("0");
      const excess = await api("manager", "POST", `/return-requests/${item.id}/refunds/confirm`, {
        ...input,
        expectedVersion: current.request.version,
        idempotencyKey: randomUUID(),
        reference: randomUUID(),
        amount: "1",
      });
      expect(excess.statusCode).toBe(409);
      expect((await state(item.id)).refunds).toHaveLength(1);
      const originalRefund = current.refunds[0].id;
      const history = await api("owner", "GET", `/rentals/${item.rentalId}/payments`);
      expect(history.statusCode).toBe(200);
      expect(history.json().data[0].returnRefunds).toHaveLength(1);
      expect(history.json().data[0].returnRefunds[0].amount).toBe(input.amount);
      const reassigned = await api("manager", "PATCH", `/return-requests/${item.id}/staff`, {
        expectedVersion: current.request.version,
        staffId: actorIds.replacement,
        reason: "Correction after staff departure",
      });
      expect(reassigned.statusCode).toBe(200);
      current = await state(item.id);
      expect(current.request.status).toBe("COMPLETED");
      expect(
        (
          await api("staff", "POST", `/return-requests/${item.id}/evidence`, {
            expectedVersion: current.request.version,
            purpose: "TIME_CORRECTION",
            filename: "receipt.png",
            mimeType: "image/png",
            dataBase64: png,
          })
        ).statusCode,
      ).toBe(403);
      const timeProof = await api("replacement", "POST", `/return-requests/${item.id}/evidence`, {
        expectedVersion: current.request.version,
        purpose: "TIME_CORRECTION",
        filename: "receipt.png",
        mimeType: "image/png",
        dataBase64: png,
      });
      current = await state(item.id);
      const proposed = await api(
        "replacement",
        "POST",
        `/return-requests/${item.id}/time-changes`,
        {
          expectedVersion: current.request.version,
          actualReturnAt: "2032-01-01T16:59:00Z",
          reason: "Verified receipt correction",
          evidencePhotoIds: [timeProof.json().data.id],
          idempotencyKey: randomUUID(),
        },
      );
      current = await state(item.id);
      expect(
        (
          await api(
            "manager",
            "POST",
            `/return-requests/${item.id}/time-changes/${proposed.json().data.id}/decision`,
            {
              expectedVersion: current.request.version,
              approve: true,
              reason: "Approved correction",
            },
          )
        ).statusCode,
      ).toBe(200);
      current = await state(item.id);
      expect(current.refunds[0].id).toBe(originalRefund);
      expect(current.settlements).toHaveLength(2);
      expect(current.settlements[0].remainingRefund).toBe(String(initialRate * 10000));
    });

    test("legacy mixed refunds require explicit allocation and respect separate remaining deposit/rent limits", async () => {
      const item = await scenario();
      const inspection = await start(item.id);
      await save(item.id, inspection);
      await complete(item.id, inspection);
      await receive(item.id);
      expect(
        (
          await api("manager", "POST", `/return-requests/${item.id}/settlement`, {
            expectedVersion: (await state(item.id)).request.version,
            damageAmount: "0",
            unusedRentRefundAmount: "0",
            reason: "FM exception approved",
          })
        ).statusCode,
      ).toBe(200);
      await legacyRentEntitlement(item.id);
      const proof = await api("manager", "POST", `/return-requests/${item.id}/evidence`, {
        expectedVersion: (await state(item.id)).request.version,
        purpose: "REFUND",
        filename: "receipt.png",
        mimeType: "image/png",
        dataBase64: png,
      });
      const input = {
        expectedVersion: (await state(item.id)).request.version,
        amount: "200000",
        reference: randomUUID(),
        evidencePhotoIds: [proof.json().data.id],
        idempotencyKey: randomUUID(),
      };
      const path = `/return-requests/${item.id}/refunds/confirm`;
      expect((await api("manager", "POST", path, input)).statusCode).toBe(409);
      expect(
        (await api("manager", "POST", path, { ...input, depositRefundAmount: "100000" }))
          .statusCode,
      ).toBe(409);
      expect(
        (
          await api("manager", "POST", path, {
            ...input,
            depositRefundAmount: "100000",
            rentRefundAmount: "99999",
          })
        ).statusCode,
      ).toBe(409);
      const valid = { ...input, depositRefundAmount: "100000", rentRefundAmount: "100000" };
      const responses = await Promise.all([
        api("manager", "POST", path, valid),
        api("manager", "POST", path, valid),
      ]);
      expect(responses.map((r) => r.statusCode)).toEqual([200, 200]);
      expect(responses[0].json().data.refundSummary).toMatchObject({
        confirmedDepositRefund: "100000",
        confirmedRentRefund: "100000",
        remainingRentRefund: "200000",
        allocationKnown: true,
      });
      expect((await api("manager", "POST", path, input)).statusCode).toBe(409);
      expect((await state(item.id)).refunds[0]).toMatchObject({
        depositRefundAmount: "100000",
        rentRefundAmount: "100000",
      });
      expect(
        (await api("manager", "POST", path, { ...valid, rentRefundAmount: "0" })).statusCode,
      ).toBe(409);
      const next = {
        ...valid,
        expectedVersion: (await state(item.id)).request.version,
        amount: "300000",
        depositRefundAmount: "0",
        rentRefundAmount: "300000",
        reference: randomUUID(),
        idempotencyKey: randomUUID(),
      };
      expect((await api("manager", "POST", path, next)).statusCode).toBe(409);
      expect((await state(item.id)).refunds).toHaveLength(1);
      const partial = { ...next, amount: "150000", rentRefundAmount: "150000" };
      const transferred = await api("manager", "POST", path, partial);
      expect(transferred.statusCode).toBe(200);
      expect(transferred.json().data.refundSummary).toMatchObject({
        confirmedDepositRefund: "100000",
        confirmedRentRefund: "250000",
        remainingRentRefund: "50000",
      });
      expect((await api("manager", "POST", path, partial)).statusCode).toBe(200);
      const beforeLegacy = await state(item.id);
      const originalRefund = beforeLegacy.refunds.find(
        (r: { id: string }) => r.id === responses[0].json().data.id,
      );
      await db
        .update(returnRefunds)
        .set({ depositRefundAmount: null, rentRefundAmount: null })
        .where(eq(returnRefunds.id, originalRefund.id));
      const legacy = await state(item.id);
      expect(legacy.refundSummary).toMatchObject({
        allocationKnown: false,
        remainingDepositRefund: null,
        confirmedDepositRefund: null,
        remainingRentRefund: null,
        confirmedRentRefund: null,
      });
      expect(legacy.refundSummary.remainingRefund).toBe(beforeLegacy.refundSummary.remainingRefund);
      expect(
        (
          await api("manager", "POST", path, {
            ...partial,
            expectedVersion: legacy.request.version,
            idempotencyKey: randomUUID(),
            reference: randomUUID(),
            amount: "1",
            rentRefundAmount: "1",
          })
        ).statusCode,
      ).toBe(409);
      expect((await state(item.id)).refunds).toEqual(legacy.refunds);
    });

    test.each(["full", "partial"] as const)(
      "legacy %s mixed refund replays its original payload without changing history",
      async (kind) => {
        const item = await scenario();
        const inspection = await start(item.id);
        await save(item.id, inspection);
        await complete(item.id, inspection);
        await receive(item.id);
        const settled = await api("manager", "POST", `/return-requests/${item.id}/settlement`, {
          expectedVersion: (await state(item.id)).request.version,
          damageAmount: "0",
          unusedRentRefundAmount: "0",
          reason: "Legacy retry regression",
        });
        expect(settled.statusCode).toBe(200);
        const settlement = await legacyRentEntitlement(item.id);
        const proof = await api("manager", "POST", `/return-requests/${item.id}/evidence`, {
          expectedVersion: (await state(item.id)).request.version,
          purpose: "REFUND",
          filename: "legacy-receipt.png",
          mimeType: "image/png",
          dataBase64: png,
        });
        expect(proof.statusCode).toBe(201);
        const input = {
          expectedVersion: (await state(item.id)).request.version,
          amount: kind === "full" ? settlement.refundEntitlement : "100000",
          reference: randomUUID(),
          evidencePhotoIds: [proof.json().data.id],
          idempotencyKey: randomUUID(),
        };
        const path = `/return-requests/${item.id}/refunds/confirm`;
        const confirmed = await api("manager", "POST", path, {
          ...input,
          depositRefundAmount:
            kind === "full"
              ? String(BigInt(settlement.depositSnapshot) - BigInt(settlement.overdueFeeAmount))
              : "50000",
          rentRefundAmount: kind === "full" ? "300000" : "50000",
        });
        expect(confirmed.statusCode).toBe(200);
        const refundId = confirmed.json().data.id;
        await db
          .update(returnRefunds)
          .set({ depositRefundAmount: null, rentRefundAmount: null })
          .where(eq(returnRefunds.id, refundId));
        const before = await state(item.id);
        const replays = await Promise.all([
          api("manager", "POST", path, input),
          api("manager", "POST", path, input),
        ]);
        expect(replays.map((response) => response.statusCode)).toEqual([200, 200]);
        for (const response of replays) {
          expect(response.json().data).toMatchObject({
            id: refundId,
            version: before.request.version,
            refundSummary: before.refundSummary,
          });
          expect(response.json().data.refundSummary.allocationKnown).toBe(kind === "full");
        }
        for (const changed of [
          { ...input, amount: String(BigInt(input.amount) + 1n) },
          { ...input, reference: randomUUID() },
          { ...input, evidencePhotoIds: [randomUUID()] },
          { ...input, depositRefundAmount: "1" },
          { ...input, depositRefundAmount: "0", rentRefundAmount: input.amount },
        ])
          expect((await api("manager", "POST", path, changed)).statusCode).toBe(409);
        expect(await state(item.id)).toEqual(before);
        expect(before.refunds).toHaveLength(1);
        expect(before.refunds[0]).toMatchObject({
          depositRefundAmount: null,
          rentRefundAmount: null,
        });
      },
    );

    test("overdue starts at the expiry instant; review still follows seven full local calendar days", async () => {
      const item = await scenario();
      const lifecycle = new RentalLifecycleService(
        new RentalLifecycleRepository(db),
        new ReturnsRepository(db),
      );
      const readRental = async () =>
        (await db.select().from(rentals).where(eq(rentals.id, item.rentalId)))[0];
      try {
        await lifecycle.sweep(new Date("2032-01-01T02:59:59.999Z"), fixture.facility);
        expect((await readRental())?.status).toBe("RETURN_PENDING");
        const at = new Date("2032-01-01T03:00:00Z");
        await Promise.all([
          lifecycle.sweep(at, fixture.facility),
          lifecycle.sweep(at, fixture.facility),
        ]);
        expect((await readRental())?.status).toBe("OVERDUE");
        expect((await state(item.id)).request.status).toBe("CONFIRMED");
        const notices = await db
          .select()
          .from(notificationOutbox)
          .where(eq(notificationOutbox.eventKey, `rental:${item.rentalId}:overdue`));
        expect(notices).toHaveLength(2);
        expect(notices.find((row) => row.recipientRole === "CUSTOMER")?.recipientEmail).toBe(
          "contact@example.test",
        );
        expect(
          notices
            .filter((row) => row.recipientRole === "FACILITY_MANAGER")
            .map((row) => row.recipientUserId),
        ).toEqual([actorIds.manager]);
        await lifecycle.sweep(new Date("2032-01-08T16:59:59.999Z"), fixture.facility);
        expect((await readRental())?.abandonedReviewAt).toBeNull();
        await lifecycle.sweep(new Date("2032-01-08T17:00:00Z"), fixture.facility);
        expect((await readRental())?.abandonedReviewAt?.toISOString()).toBe(
          "2032-01-08T17:00:00.000Z",
        );
        expect((await readRental())?.closedAt).toBeNull();
        expect(
          (await db.select().from(storageUnits).where(eq(storageUnits.id, item.unitId)))[0]?.status,
        ).toBe("OCCUPIED");
        expect(
          await db
            .select()
            .from(notificationOutbox)
            .where(eq(notificationOutbox.eventKey, `rental:${item.rentalId}:abandoned-review`)),
        ).toHaveLength(1);
      } finally {
        setSystemTime(new Date("2032-01-02T05:00:00Z"));
      }
    });

    test("actual return by the expiry instant prevents overdue even when the case remains open", async () => {
      const item = await scenario();
      await receive(item.id, "2032-01-01T03:00:00Z");
      await new RentalLifecycleService(
        new RentalLifecycleRepository(db),
        new ReturnsRepository(db),
      ).sweep(new Date("2032-01-12T05:00:00Z"), fixture.facility);
      const [row] = await db.select().from(rentals).where(eq(rentals.id, item.rentalId));
      expect(row?.status).toBe("RETURN_PENDING");
      expect(row?.abandonedReviewAt).toBeNull();
    });

    test("cancel after local midnight records overdue atomically and sweep repairs missing events", async () => {
      const item = await scenario("PENDING");
      const lifecycle = new RentalLifecycleService(
        new RentalLifecycleRepository(db),
        new ReturnsRepository(db),
      );
      const notices = () =>
        db
          .select()
          .from(notificationOutbox)
          .where(eq(notificationOutbox.eventKey, `rental:${item.rentalId}:overdue`));
      const cancelled = await api("owner", "POST", `/return-requests/${item.id}/cancel`, {
        expectedVersion: (await state(item.id)).request.version,
      });
      expect(cancelled.statusCode).toBe(200);
      expect(await notices()).toHaveLength(2);
      await Promise.all([
        lifecycle.sweep(new Date(), fixture.facility),
        lifecycle.sweep(new Date(), fixture.facility),
      ]);
      expect(await notices()).toHaveLength(2);
      await db
        .delete(notificationOutbox)
        .where(eq(notificationOutbox.eventKey, `rental:${item.rentalId}:overdue`));
      await lifecycle.sweep(new Date(), fixture.facility);
      expect(await notices()).toHaveLength(2);
      expect((await state(item.id)).request.status).toBe("CANCELLED");
    });

    test("sweep advances beyond a full batch with no eligible email recipients", async () => {
      const items = [];
      for (let i = 0; i < 101; i++) items.push(await scenario("PENDING"));
      items.sort((a, b) => a.rentalId.localeCompare(b.rentalId));
      const last = items.at(-1);
      if (!last) throw new Error("Missing batch fixture");
      await db
        .update(bookings)
        .set({ contactEmail: "" })
        .where(
          inArray(
            bookings.id,
            items.slice(0, -1).map((item) => item.bookingId),
          ),
        );
      await db
        .update(facilityAssignments)
        .set({ isActive: false })
        .where(
          and(
            eq(facilityAssignments.facilityId, fixture.facility),
            eq(facilityAssignments.userId, actorIds.manager),
          ),
        );
      try {
        const lifecycle = new RentalLifecycleService(
          new RentalLifecycleRepository(db),
          new ReturnsRepository(db),
        );
        await lifecycle.sweep(new Date(), fixture.facility);
        expect(
          (await db.select().from(rentals).where(eq(rentals.id, last.rentalId)))[0]?.status,
        ).toBe("OVERDUE");
        expect(
          await db
            .select()
            .from(notificationOutbox)
            .where(eq(notificationOutbox.eventKey, `rental:${last.rentalId}:overdue`)),
        ).toHaveLength(1);
      } finally {
        await db
          .update(facilityAssignments)
          .set({ isActive: true })
          .where(
            and(
              eq(facilityAssignments.facilityId, fixture.facility),
              eq(facilityAssignments.userId, actorIds.manager),
            ),
          );
      }
    });

    test("expiry reminders honor configured local time and immediate creation shares scheduler dedupe", async () => {
      const item = await scenario();
      await db
        .update(rentals)
        .set({ expectedEndAt: new Date("2032-01-09T03:00:00Z") })
        .where(eq(rentals.id, item.rentalId));
      const lifecycle = new RentalLifecycleService(
        new RentalLifecycleRepository(db),
        new ReturnsRepository(db),
      );
      const notices = () =>
        db
          .select()
          .from(notificationOutbox)
          .where(eq(notificationOutbox.eventKey, `rental:${item.rentalId}:expiry`));
      await lifecycle.sweep(new Date("2032-01-02T01:59:59.999Z"), fixture.facility);
      expect(await notices()).toHaveLength(0);
      await Promise.all([
        lifecycle.sweep(new Date("2032-01-02T02:00:00Z"), fixture.facility),
        lifecycle.sweep(new Date("2032-01-02T02:00:00Z"), fixture.facility),
      ]);
      expect(await notices()).toHaveLength(1);
      const immediate = await scenario();
      await db
        .update(rentals)
        .set({ expectedEndAt: new Date("2032-01-08T03:00:00Z") })
        .where(eq(rentals.id, immediate.rentalId));
      await db.transaction(async (tx) => {
        const [row] = await tx.select().from(rentals).where(eq(rentals.id, immediate.rentalId));
        if (!row) throw new Error("Missing fixture");
        await recordImmediateExpiry(tx, row, new Date("2032-01-02T00:00:00Z"));
      });
      await lifecycle.sweep(new Date("2032-01-02T02:00:00Z"), fixture.facility);
      expect(
        await db
          .select()
          .from(notificationOutbox)
          .where(eq(notificationOutbox.eventKey, `rental:${immediate.rentalId}:expiry`)),
      ).toHaveLength(1);
    });

    test("configured reminder time overrides 09:00 and existing facility timezone works before return-calendar setup", async () => {
      const item = await scenario();
      const lifecycle = new RentalLifecycleService(
        new RentalLifecycleRepository(db),
        new ReturnsRepository(db),
      );
      const [calendar] = await db
        .select()
        .from(facilityReturnCalendars)
        .where(eq(facilityReturnCalendars.facilityId, fixture.facility));
      if (!calendar) throw new Error("Missing calendar fixture");
      try {
        await db
          .update(rentals)
          .set({ expectedEndAt: new Date("2032-01-09T03:00:00Z") })
          .where(eq(rentals.id, item.rentalId));
        await db
          .update(facilityReturnCalendars)
          .set({ reminderTime: "10:00" })
          .where(eq(facilityReturnCalendars.facilityId, fixture.facility));
        const notice = () =>
          db
            .select()
            .from(notificationOutbox)
            .where(eq(notificationOutbox.eventKey, `rental:${item.rentalId}:expiry`));
        await lifecycle.sweep(new Date("2032-01-02T02:59:59.999Z"), fixture.facility);
        expect(await notice()).toHaveLength(0);
        await lifecycle.sweep(new Date("2032-01-02T03:00:00Z"), fixture.facility);
        expect(await notice()).toHaveLength(1);
        await db
          .delete(facilityReturnCalendars)
          .where(eq(facilityReturnCalendars.facilityId, fixture.facility));
        await db
          .update(facilityOperatingHours)
          .set({ timezone: "America/New_York" })
          .where(eq(facilityOperatingHours.facilityId, fixture.facility));
        // The exact expiry instant is independent of New York's local midnight.
        await db
          .update(rentals)
          .set({ expectedEndAt: new Date("2032-02-01T03:00:00Z") })
          .where(eq(rentals.id, item.rentalId));
        await lifecycle.sweep(new Date("2032-02-01T02:59:59.999Z"), fixture.facility);
        expect(
          (await db.select().from(rentals).where(eq(rentals.id, item.rentalId)))[0]?.status,
        ).toBe("RETURN_PENDING");
        await lifecycle.sweep(new Date("2032-02-01T03:00:00Z"), fixture.facility);
        expect(
          (await db.select().from(rentals).where(eq(rentals.id, item.rentalId)))[0]?.status,
        ).toBe("OVERDUE");
      } finally {
        await db
          .insert(facilityReturnCalendars)
          .values(calendar)
          .onConflictDoUpdate({ target: facilityReturnCalendars.facilityId, set: calendar });
        await db
          .update(facilityOperatingHours)
          .set({ timezone: "Asia/Ho_Chi_Minh" })
          .where(eq(facilityOperatingHours.facilityId, fixture.facility));
      }
    });

    test("verified payment retries persist one payment/booking notification and outbox rolls back with business work", async () => {
      const item = await scenario();
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.bookingId, item.bookingId));
      if (!payment) throw new Error("Missing payment");
      await db
        .update(bookings)
        .set({
          status: "DRAFT",
          checkInDate: "2032-01-03",
          rentalEndAt: new Date("2032-02-03T03:00:00Z"),
        })
        .where(eq(bookings.id, item.bookingId));
      await db
        .update(payments)
        .set({ provider: "sepay", providerPaymentId: payment.id, status: "PENDING", paidAt: null })
        .where(eq(payments.id, payment.id));
      await db
        .update(capacityAllocations)
        .set({
          kind: "HOLD",
          accessTokenHash: payment.holdTokenHash,
          expiresAt: new Date("2032-01-03T05:00:00Z"),
        })
        .where(eq(capacityAllocations.referenceId, item.bookingId));
      const repository = new PaymentsRepository(db);
      const event = {
        providerEventId: randomUUID(),
        paymentCode: payment.paymentCode,
        amount: 2000000,
        transferType: "in" as const,
        referenceCode: randomUUID(),
        metadata: {},
        successful: true,
        currency: "VND",
      };
      const results = await Promise.all([
        repository.processBookingPaymentEvent(event),
        repository.processBookingPaymentEvent(event),
      ]);
      expect(results.filter((r) => r?.processed)).toHaveLength(1);
      const notices = await db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.bookingId, item.bookingId));
      expect(notices.filter((n) => n.eventType === "PAYMENT_CONFIRMED")).toHaveLength(1);
      expect(notices.filter((n) => n.eventType === "BOOKING_CONFIRMED")).toHaveLength(2);
      expect(
        notices.find((n) => n.eventType === "BOOKING_CONFIRMED" && n.recipientRole === "CUSTOMER")
          ?.bookingEmail?.paidAt,
      ).toBe(new Date().toISOString());
      const rollbackKey = `rollback:${randomUUID()}`;
      await expect(
        db.transaction(async (tx) => {
          await recordLifecycleEvent(tx, {
            key: rollbackKey,
            type: "RETURN_CHANGED",
            bookingId: item.bookingId,
          });
          throw new Error("Rollback business work");
        }),
      ).rejects.toThrow("Rollback business work");
      expect(
        await db
          .select()
          .from(notificationOutbox)
          .where(eq(notificationOutbox.eventKey, rollbackKey)),
      ).toHaveLength(0);
    });

    test.skipIf(!process.env.REDIS_TEST_URL)(
      "durable booking intent recovers a missed enqueue, freezes access payload and survives lost provider acknowledgement",
      async () => {
        await db
          .update(notificationOutbox)
          .set({ status: "SENT" })
          .where(eq(notificationOutbox.facilityId, fixture.facility));
        const item = await scenario();
        // Commit the same event used by verified-payment transactions, then simulate
        // the API dying before it can enqueue anything. Payment retry is covered above.
        await db.transaction((tx) =>
          recordLifecycleEvent(tx, {
            key: `booking:${item.bookingId}:confirmed`,
            type: "BOOKING_CONFIRMED",
            bookingId: item.bookingId,
            occurredAt: new Date(),
          }),
        );
        const redis = new Redis(process.env.REDIS_TEST_URL as string, {
          maxRetriesPerRequest: null,
        });
        const queueName = `storex-test-mail-${randomUUID()}`;
        const queue = new Queue<MailJobData>(queueName, { connection: redis });
        const repository = new OutboxRepository(db);
        const secret = "test-only-durable-booking-secret-at-least-32-characters";
        const bookingMail = new BookingMailService(repository, {
          redis,
          queue,
          secret,
          publicAppUrl: "http://localhost:3000",
          qrTokenSecret: "test-qr-secret",
        });
        const sent = new Map<string, string>();
        const mail = {
          async send(message: { deliveryId: string; text: string }) {
            const prior = sent.get(message.deliveryId);
            if (prior) expect(message.text).toBe(prior);
            sent.set(message.deliveryId, message.text);
            return { providerMessageId: `provider-${message.deliveryId}` };
          },
        };
        const sender = new OutboxService(repository, mail, bookingMail);
        const current = async () =>
          (
            await db
              .select()
              .from(notificationOutbox)
              .where(eq(notificationOutbox.eventKey, `booking:${item.bookingId}:confirmed`))
          )[0];
        let token: string | undefined;
        try {
          expect(await queue.getJob(mailJobId(item.bookingId))).toBeUndefined();
          const add = spyOn(queue, "add").mockRejectedValueOnce(new Error("Queue unavailable"));
          await sender.dispatch(new Date(), fixture.facility);
          add.mockRestore();
          expect((await current())?.status).toBe("PENDING");
          expect((await current())?.firstAttemptAt).toBeNull();
          await sender.dispatch(new Date(Date.now() + 12000), fixture.facility);
          expect((await current())?.status).toBe("ENQUEUED");
          expect((await current())?.firstAttemptAt).toBeNull();
          const job = await queue.getJob(mailJobId(item.bookingId));
          if (!job) throw new Error("Missing durable booking job");
          const decoded = JSON.parse(decryptMailPayload(job.data.payload, secret, item.bookingId));
          token = new URL(decoded.trackingUrl).hash.slice("#token=".length);
          expect(decoded.recipientEmail).toBe("contact@example.test");
          expect(decoded.qrUrl).toContain("/check-in?token=");
          expect(job.data.expiresAt).toBe(
            new Date(Date.now() + BOOKING_ACCESS.magicTtl * 1000).toISOString(),
          );
          expect((await current())?.mailPayload).not.toContain(token);
          expect((await api("owner", "GET", "/notifications?limit=100")).body).not.toContain(token);
          await Promise.all([
            sender.dispatch(new Date(Date.now() + 120000), fixture.facility),
            sender.dispatch(new Date(Date.now() + 120000), fixture.facility),
          ]);
          expect((await queue.getJobs(["waiting"])).filter((j) => j.id === job.id)).toHaveLength(1);
          const ack = spyOn(repository, "bookingSent").mockRejectedValueOnce(
            new Error("Lost DB acknowledgement"),
          );
          await expect(bookingMail.deliver(job.data, mail)).rejects.toThrow(
            "Lost DB acknowledgement",
          );
          ack.mockRestore();
          expect((await current())?.status).toBe("ENQUEUED");
          const legacyCipher = encryptMailPayload(JSON.stringify(decoded), secret, item.bookingId);
          await bookingMail.deliver({ ...job.data, payload: legacyCipher }, mail);
          expect((await current())?.mailPayload).toBe(job.data.payload);
          expect(sent.size).toBe(1);
          expect((await current())?.status).toBe("SENT");
          await job.remove();
          expect(await createBookingsService(app).getStatus(item.bookingId)).toBe("SENT");
          await bookingMail.deliver(job.data, mail);
          expect(sent.size).toBe(1);
          const stopped = await scenario();
          await db.transaction((tx) =>
            recordLifecycleEvent(tx, {
              key: `booking:${stopped.bookingId}:confirmed`,
              type: "BOOKING_CONFIRMED",
              bookingId: stopped.bookingId,
              occurredAt: new Date(),
            }),
          );
          await db
            .update(notificationOutbox)
            .set({ firstAttemptAt: new Date(Date.now() - 24 * 3600000) })
            .where(eq(notificationOutbox.eventKey, `booking:${stopped.bookingId}:confirmed`));
          await expect(
            bookingMail.deliver({ ...job.data, deliveryId: stopped.bookingId }, mail),
          ).rejects.toThrow();
          expect(
            (
              await db
                .select()
                .from(notificationOutbox)
                .where(eq(notificationOutbox.eventKey, `booking:${stopped.bookingId}:confirmed`))
            )[0]?.status,
          ).toBe("REVIEW_REQUIRED");
          const expired = await scenario();
          await db.transaction((tx) =>
            recordLifecycleEvent(tx, {
              key: `booking:${expired.bookingId}:confirmed`,
              type: "BOOKING_CONFIRMED",
              bookingId: expired.bookingId,
              occurredAt: new Date(Date.now() - 8 * 86400000),
            }),
          );
          await sender.dispatch(new Date(), fixture.facility);
          expect(
            (
              await db
                .select()
                .from(notificationOutbox)
                .where(eq(notificationOutbox.eventKey, `booking:${expired.bookingId}:confirmed`))
            )[0]?.status,
          ).toBe("SUPPRESSED");
          expect(await queue.getJob(mailJobId(expired.bookingId))).toBeUndefined();
          // An already prepared legacy job without an outbox row still uses the
          // original payload and delivery ID, rather than generating a second link.
          await db
            .delete(notificationOutbox)
            .where(eq(notificationOutbox.eventKey, `booking:${item.bookingId}:confirmed`));
          await bookingMail.deliver(job.data, mail);
          expect(sent.size).toBe(1);
        } finally {
          await queue.close();
          const keys = await redis.keys(`bull:${queueName}:*`);
          keys.push(bookingDeliveryKey(item.bookingId));
          if (token) keys.push(bookingMagicKey(token));
          if (keys.length) await redis.del(...keys);
          redis.disconnect();
        }
      },
    );

    test("durable inbox authorization and mail retries, concurrency, lost acknowledgements and expiry preserve one logical event", async () => {
      const item = await scenario();
      // Only this run's facility-owned records; do not dispatch or modify other local data.
      await db
        .update(notificationOutbox)
        .set({ status: "SENT" })
        .where(eq(notificationOutbox.facilityId, fixture.facility));
      const key = `dispatch:${randomUUID()}`;
      await db.transaction((tx) =>
        recordLifecycleEvent(tx, {
          key,
          type: "RETURN_CHANGED",
          bookingId: item.bookingId,
          managers: true,
        }),
      );
      const ownerInbox = await api("owner", "GET", "/notifications?limit=100");
      expect(ownerInbox.statusCode).toBe(200);
      expect(
        ownerInbox.json().data.some((n: { bookingId: string }) => n.bookingId === item.bookingId),
      ).toBe(true);
      expect((await api("other", "GET", "/notifications")).json().data).toEqual([]);
      expect((await api("outsider", "GET", "/notifications")).json().data).toEqual([]);
      expect((await api("admin", "GET", "/notifications")).statusCode).toBe(403);
      const repository = new OutboxRepository(db);
      const sent: string[] = [];
      let fail = true;
      const sender = new OutboxService(repository, {
        async send(message) {
          sent.push(message.deliveryId);
          if (fail) throw new Error("Provider unavailable");
          return { providerMessageId: message.deliveryId };
        },
      });
      const now = new Date();
      await sender.dispatch(now, fixture.facility);
      expect((await state(item.id)).request.status).toBe("CONFIRMED");
      const pending = await db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.eventKey, key));
      expect(pending.map((row) => row.status)).toEqual(["PENDING", "PENDING"]);
      fail = false;
      // Simulate provider accepted the second attempt but DB acknowledgement is lost.
      const finish = repository.finish.bind(repository);
      let loseAck = true;
      const spy = spyOn(repository, "finish").mockImplementation(async (...args) => {
        if (args[1] === "SENT" && loseAck) {
          loseAck = false;
          throw new Error("Acknowledgement lost");
        }
        return finish(...args);
      });
      try {
        await Promise.all([
          sender.dispatch(new Date(now.getTime() + 60000), fixture.facility),
          sender.dispatch(new Date(now.getTime() + 60000), fixture.facility),
        ]);
      } finally {
        spy.mockRestore();
      }
      await sender.dispatch(new Date(now.getTime() + 120000), fixture.facility);
      const done = await db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.eventKey, key));
      expect(done.map((row) => row.status)).toEqual(["SENT", "SENT"]);
      expect(new Set(sent).size).toBe(2);
      const reviewKey = `review:${randomUUID()}`;
      await db.transaction((tx) =>
        recordLifecycleEvent(tx, {
          key: reviewKey,
          type: "RETURN_CHANGED",
          bookingId: item.bookingId,
        }),
      );
      await db
        .update(notificationOutbox)
        .set({ firstAttemptAt: new Date(now.getTime() - 24 * 3600000), attempts: 1 })
        .where(eq(notificationOutbox.eventKey, reviewKey));
      const count = sent.length;
      await sender.dispatch(now, fixture.facility);
      expect(sent).toHaveLength(count);
      expect(
        (
          await db
            .select()
            .from(notificationOutbox)
            .where(eq(notificationOutbox.eventKey, reviewKey))
        )[0]?.status,
      ).toBe("REVIEW_REQUIRED");
      const revokedKey = `revoked:${randomUUID()}`;
      await db.transaction((tx) =>
        recordLifecycleEvent(tx, {
          key: revokedKey,
          type: "RETURN_CHANGED",
          bookingId: item.bookingId,
          managers: true,
          customer: false,
        }),
      );
      await db
        .update(facilityAssignments)
        .set({ isActive: false })
        .where(
          and(
            eq(facilityAssignments.facilityId, fixture.facility),
            eq(facilityAssignments.userId, actorIds.manager),
          ),
        );
      try {
        expect((await api("manager", "GET", "/notifications")).json().data).toEqual([]);
        await sender.dispatch(now, fixture.facility);
        expect(sent).toHaveLength(count);
        expect(
          (
            await db
              .select()
              .from(notificationOutbox)
              .where(eq(notificationOutbox.eventKey, revokedKey))
          )[0]?.status,
        ).toBe("SUPPRESSED");
      } finally {
        await db
          .update(facilityAssignments)
          .set({ isActive: true })
          .where(
            and(
              eq(facilityAssignments.facilityId, fixture.facility),
              eq(facilityAssignments.userId, actorIds.manager),
            ),
          );
      }
    });
  },
);
