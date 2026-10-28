import { createHash, createHmac } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, asc, eq, gt, inArray, isNull, lt, notExists, or } from "drizzle-orm";
import { db, queryClient } from "./client";
import { loadApiEnv } from "./env";
import {
  AppointmentStatus,
  AppointmentType,
  accounts,
  appointments,
  CapacityAllocationKind,
  CapacityAllocationStatus,
  capacityAllocations,
  checkInSlots,
  checkInVerifications,
  facilities,
  facilityAssignments,
  PaymentRefundReason,
  PaymentStatus,
  payments,
  RentalStatus,
  ReservationStatus,
  ReturnRequestStatus,
  rentalPriceRanges,
  rentals,
  reservations,
  StorageUnitStatus,
  storageUnits,
  systemSettings,
  UserRole,
  UserStatus,
  unitAssignments,
  unitTypes,
  users,
} from "./schema";
import { SYSTEM_SETTING_DEFINITIONS, SystemSettingKey } from "./schema/domain";

type SeedTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function saveCheckInAppointment(
  tx: SeedTransaction,
  input: {
    reservationId: string;
    facilityId: string;
    customerId: string;
    contactPhone?: string | null;
    scheduledDate: string;
    slotId: string;
    createdBy: string;
    status: AppointmentStatus;
    assignedStaffId?: string | null;
  },
) {
  const [existing] = await tx
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.reservationId, input.reservationId),
        eq(appointments.appointmentType, AppointmentType.CHECK_IN),
      ),
    );
  const { contactPhone, ...appointment } = input;
  const values = {
    ...appointment,
    appointmentType: AppointmentType.CHECK_IN,
    ...(contactPhone !== undefined ? { contactPhone } : {}),
  };
  if (existing) {
    await tx.update(appointments).set(values).where(eq(appointments.id, existing.id));
  } else {
    await tx.insert(appointments).values(values);
  }
}

// Stable local fixtures only. Keep IDs unchanged when adding or reordering seed data.
export const SEED_IDS = {
  demoCheckInSlot: "20000000-0000-4000-8000-000000000005",
  demoCheckInBooking: "83000000-0000-4000-8000-000000000002",
  facilities: {
    "HCM-01": "30000000-0000-4000-8000-000000000001",
    "HCM-02": "30000000-0000-4000-8000-000000000002",
    "HCM-03": "30000000-0000-4000-8000-000000000003",
    "HCM-04": "30000000-0000-4000-8000-000000000004",
    "HCM-05": "30000000-0000-4000-8000-000000000005",
    "HCM-06": "30000000-0000-4000-8000-000000000006",
    "HCM-07": "30000000-0000-4000-8000-000000000007",
    "HCM-08": "30000000-0000-4000-8000-000000000008",
    "HCM-09": "30000000-0000-4000-8000-000000000009",
    "HCM-10": "30000000-0000-4000-8000-000000000010",
  },
  unitTypes: {
    "UT-2M": "60000000-0000-4000-8000-000000000001",
    "UT-4M": "60000000-0000-4000-8000-000000000002",
    "UT-6M": "60000000-0000-4000-8000-000000000003",
    "UT-AC-4M": "60000000-0000-4000-8000-000000000004",
    "UT-1M": "60000000-0000-4000-8000-000000000005",
    "UT-8M": "60000000-0000-4000-8000-000000000006",
    "UT-10M": "60000000-0000-4000-8000-000000000007",
    "UT-15M": "60000000-0000-4000-8000-000000000008",
  },
  checkInSlots: [
    "20000000-0000-4000-8000-000000000001",
    "20000000-0000-4000-8000-000000000002",
    "20000000-0000-4000-8000-000000000003",
    "20000000-0000-4000-8000-000000000004",
  ],
  storageUnits: {
    "HCM-01-001": "70000000-0000-4000-8000-000000000001",
    "HCM-01-002": "70000000-0000-4000-8000-000000000002",
    "HCM-01-003": "70000000-0000-4000-8000-000000000003",
    "HCM-01-004": "70000000-0000-4000-8000-000000000004",
    "HCM-01-005": "70000000-0000-4000-8000-000000000005",
    "HCM-01-006": "70000000-0000-4000-8000-000000000006",
    "HCM-01-007": "70000000-0000-4000-8000-000000000007",
    "HCM-01-008": "70000000-0000-4000-8000-000000000008",
  },
  reservations: {
    "BK-2026-0001": "80000000-0000-4000-8000-000000000001",
    "BK-2026-0002": "80000000-0000-4000-8000-000000000002",
    "BK-2026-0003": "80000000-0000-4000-8000-000000000003",
  },
} as const;

export const SEED_USERS = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    role: UserRole.STORAGE_CUSTOMER,
    email: "customer@metastorage.vn",
    name: "Lê Thị Mai Linh",
    phone: "0900000001",
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    role: UserRole.FACILITY_STAFF,
    email: "staff@metastorage.vn",
    name: "Trần Quốc Huy",
    phone: "0900000002",
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    role: UserRole.FACILITY_MANAGER,
    email: "manager@metastorage.vn",
    name: "Lê Thu Hà",
    phone: "0900000003",
  },
  {
    id: "40000000-0000-4000-8000-000000000004",
    role: UserRole.BUSINESS_OPERATIONS_MANAGER,
    email: "bom@metastorage.vn",
    name: "Business Operation Manager",
    phone: "0900000004",
  },
  {
    id: "40000000-0000-4000-8000-000000000005",
    role: UserRole.SYSTEM_ADMINISTRATOR,
    email: "admin@metastorage.vn",
    name: "Quản trị viên demo",
    phone: "0900000005",
  },
] as const;

export const SEED_DEMO_USERS = [
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `40000000-0000-4000-8000-${String(101 + index).padStart(12, "0")}`,
    role: UserRole.STORAGE_CUSTOMER,
    email: `customer${index + 1}@metastorage.test`,
    name:
      [
        "Nguyễn Minh An",
        "Trần Ngọc Anh",
        "Lê Hoàng Nam",
        "Phạm Thảo Vy",
        "Võ Thanh Tâm",
        "Đặng Hải Yến",
      ][index] ?? "Khách demo",
    phone: `090100000${index + 1}`,
  })),
  ...Array.from({ length: 9 }, (_, index) => ({
    id: `40000000-0000-4000-8000-${String(202 + index).padStart(12, "0")}`,
    role: UserRole.FACILITY_MANAGER,
    email: `manager.hcm${String(index + 2).padStart(2, "0")}@metastorage.test`,
    name: `Quản lý demo HCM-${String(index + 2).padStart(2, "0")}`,
    phone: `09020000${String(index + 2).padStart(2, "0")}`,
  })),
  ...Array.from({ length: 9 }, (_, index) => ({
    id: `40000000-0000-4000-8000-${String(302 + index).padStart(12, "0")}`,
    role: UserRole.FACILITY_STAFF,
    email: `staff.hcm${String(index + 2).padStart(2, "0")}@metastorage.test`,
    name: `Nhân viên demo HCM-${String(index + 2).padStart(2, "0")}`,
    phone: `09030000${String(index + 2).padStart(2, "0")}`,
  })),
];

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const FLOW2_STAFF_ID = "40000000-0000-4000-8000-000000000006";
const FLOW2_STAFF_EMAIL = "staff@metastorage.test";
const FLOW2_STAFF_PASSWORD = "12345678";
export const DEV_AUTH_PASSWORD = "12345678";
const FLOW3_IDS = {
  reservations: [
    "84000000-0000-4000-8000-000000000001",
    "84000000-0000-4000-8000-000000000002",
    "84000000-0000-4000-8000-000000000003",
    "84000000-0000-4000-8000-000000000004",
    "84000000-0000-4000-8000-000000000005",
    "84000000-0000-4000-8000-000000000006",
  ],
  rentals: [
    "85000000-0000-4000-8000-000000000001",
    "85000000-0000-4000-8000-000000000002",
    "85000000-0000-4000-8000-000000000003",
    "85000000-0000-4000-8000-000000000004",
    "85000000-0000-4000-8000-000000000005",
    "85000000-0000-4000-8000-000000000006",
  ],
  units: [
    "70000000-0000-4000-8000-000000000019",
    "70000000-0000-4000-8000-000000000020",
    "70000000-0000-4000-8000-000000000021",
    "70000000-0000-4000-8000-000000000022",
    "70000000-0000-4000-8000-000000000023",
    "70000000-0000-4000-8000-000000000024",
  ],
};
const FLOW3_BOOKING_CODES = [
  "DEMO-FLOW3-ACTIVE",
  "DEMO-FLOW3-RETURN-PENDING",
  "DEMO-FLOW3-OVERDUE",
  "DEMO-FLOW3-CLOSED",
  "DEMO-FLOW3-ACTIVE-2",
  "DEMO-FLOW3-RETURN-PENDING-2",
];
function getSeedNow() {
  const configured = process.env.SEED_NOW;
  if (!configured) return new Date();
  const value = new Date(configured);
  if (Number.isNaN(value.getTime())) throw new Error("SEED_NOW must be a valid ISO-8601 timestamp");
  return value;
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const id = (prefix: string, ordinal: number) =>
  `${prefix}-0000-4000-8000-${String(ordinal).padStart(12, "0")}`;

export async function seedImmediateCheckInSlot(seedNow = getSeedNow()) {
  const nodeEnv = process.env.NODE_ENV ?? loadApiEnv().NODE_ENV;
  if (nodeEnv?.trim().toLowerCase() === "production")
    throw new Error("Local demo seeding is disabled in production");
  const local = new Date(seedNow.getTime() + 7 * HOUR_MS).toISOString();
  const date = local.slice(0, 10);
  const localMinutes = Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
  const demoMinutes = Math.min(Math.max(localMinutes, 8 * 60), 19 * 60 + 59);
  const startTime = `${String(Math.floor(demoMinutes / 60)).padStart(2, "0")}:${String(demoMinutes % 60).padStart(2, "0")}:00`;
  const start = new Date(`${date}T${startTime}+07:00`);
  const end = new Date(start.getTime() + 30 * DAY_MS);
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(reservations)
      .where(eq(reservations.id, SEED_IDS.demoCheckInBooking))
      .for("update");
    if (existing) {
      const [rental] = await tx
        .select({ id: rentals.id })
        .from(rentals)
        .where(eq(rentals.reservationId, existing.id));
      const [verification] = await tx
        .select({ id: checkInVerifications.id })
        .from(checkInVerifications)
        .where(eq(checkInVerifications.reservationId, existing.id));
      if (existing.status !== "CONFIRMED" || rental || verification) {
        console.log("DEMO-CHECKIN-NOW already progressed; keeping its booking and slot unchanged.");
        return;
      }
    }
    await tx
      .insert(checkInSlots)
      .values({
        id: SEED_IDS.demoCheckInSlot,
        name: "Demo check-in ngay",
        startTime,
        endTime: "23:59:59.999999",
      })
      .onConflictDoUpdate({ target: checkInSlots.id, set: { startTime } });
    if (!existing) {
      const [source] = await tx
        .select()
        .from(reservations)
        .where(eq(reservations.id, SEED_IDS.reservations["BK-2026-0001"]));
      if (!source) throw new Error("Run db:seed before preparing the immediate check-in demo");
      const [sourceAppointment] = await tx
        .select({ contactPhone: appointments.contactPhone })
        .from(appointments)
        .where(
          and(
            eq(appointments.reservationId, source.id),
            eq(appointments.appointmentType, AppointmentType.CHECK_IN),
          ),
        );
      const [unit] = await tx
        .select()
        .from(storageUnits)
        .where(
          and(
            eq(storageUnits.facilityId, source.facilityId),
            eq(storageUnits.unitTypeId, source.unitTypeId),
            eq(storageUnits.status, StorageUnitStatus.AVAILABLE),
            notExists(
              tx
                .select({ id: unitAssignments.id })
                .from(unitAssignments)
                .where(
                  and(
                    eq(unitAssignments.physicalUnitId, storageUnits.id),
                    eq(unitAssignments.status, "ACTIVE"),
                  ),
                ),
            ),
          ),
        )
        .orderBy(storageUnits.code)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!unit) throw new Error("No available demo unit; existing reservations were preserved");
      const bookingId = SEED_IDS.demoCheckInBooking;
      const tokenHash = hash(hash(`local-seed:${bookingId}`));
      await tx.insert(reservations).values({
        ...source,
        id: bookingId,
        reservationCode: "DEMO-CHECKIN-NOW",
        rentalEndAt: end,
        status: ReservationStatus.CONFIRMED,
        qrTokenHash: hash(
          createHmac(
            "sha256",
            process.env.QR_TOKEN_SECRET ?? loadApiEnv().QR_TOKEN_SECRET ?? "storex-dev-qr-secret",
          )
            .update(bookingId)
            .digest("hex"),
        ),
        createdAt: seedNow,
        updatedAt: seedNow,
      });
      await saveCheckInAppointment(tx, {
        reservationId: bookingId,
        facilityId: source.facilityId,
        customerId: source.customerId,
        contactPhone: sourceAppointment?.contactPhone ?? null,
        scheduledDate: date,
        slotId: SEED_IDS.demoCheckInSlot,
        createdBy: source.customerId,
        status: AppointmentStatus.CONFIRMED,
        assignedStaffId: SEED_USERS[1].id,
      });
      await tx.insert(payments).values({
        id: id("13000000", 2),
        reservationId: bookingId,
        holdTokenHash: tokenHash,
        provider: "MOCK",
        providerPaymentId: `local-seed:${bookingId}`,
        idempotencyKey: `local-seed:${bookingId}`,
        paymentCode: "DEMO-CHECKIN-NOW-PAID",
        totalAmount: source.totalAmount,
        currency: "VND",
        status: PaymentStatus.SUCCEEDED,
        paidAt: seedNow,
      });
      await tx.insert(unitAssignments).values({
        id: id("b4000000", 2),
        reservationId: bookingId,
        physicalUnitId: unit.id,
        assignedBy: SEED_USERS[2].id,
        status: "ACTIVE",
        reason: "Local demo: immediate check-in",
      });
      await tx
        .update(storageUnits)
        .set({ status: StorageUnitStatus.RESERVED })
        .where(eq(storageUnits.id, unit.id));
      await tx.insert(capacityAllocations).values({
        id: id("a4000000", 2),
        facilityId: source.facilityId,
        unitTypeId: source.unitTypeId,
        referenceId: bookingId,
        kind: CapacityAllocationKind.BOOKING,
        status: CapacityAllocationStatus.ACTIVE,
        startsAt: start,
        endsAt: end,
      });
    } else {
      await tx
        .update(reservations)
        .set({
          rentalEndAt: end,
          updatedAt: seedNow,
        })
        .where(eq(reservations.id, existing.id));
      await saveCheckInAppointment(tx, {
        reservationId: existing.id,
        facilityId: existing.facilityId,
        customerId: existing.customerId,
        scheduledDate: date,
        slotId: SEED_IDS.demoCheckInSlot,
        createdBy: existing.customerId,
        status: AppointmentStatus.CONFIRMED,
        assignedStaffId: SEED_USERS[1].id,
      });
      await tx
        .update(capacityAllocations)
        .set({ startsAt: start, endsAt: end, updatedAt: seedNow })
        .where(
          and(
            eq(capacityAllocations.referenceId, existing.id),
            eq(capacityAllocations.kind, CapacityAllocationKind.BOOKING),
            eq(capacityAllocations.status, CapacityAllocationStatus.ACTIVE),
          ),
        );
    }
    console.log(
      `Immediate check-in: DEMO-CHECKIN-NOW, ${date} ${startTime} +07:00; staff ${SEED_USERS[1].email}`,
    );
  });
}

// Fictional local fixtures only. No provider checkout, webhook or email is sent.
async function seedDemoData(seedNow: Date) {
  const flow2CheckInDate = await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values(
        SEED_DEMO_USERS.map((user) => ({
          ...user,
          emailVerified: true,
          status: UserStatus.ACTIVE,
        })),
      )
      .onConflictDoNothing();
    const facilityRows = await tx
      .select()
      .from(facilities)
      .where(inArray(facilities.id, Object.values(SEED_IDS.facilities)))
      .orderBy(asc(facilities.code));
    const typeRows = await tx
      .select()
      .from(unitTypes)
      .where(inArray(unitTypes.facilityId, Object.values(SEED_IDS.facilities)))
      .orderBy(asc(unitTypes.code));
    const slots = await tx
      .select()
      .from(checkInSlots)
      .where(inArray(checkInSlots.id, [...SEED_IDS.checkInSlots]))
      .orderBy(asc(checkInSlots.startTime));
    const today = new Date(seedNow.getTime() + 7 * 3600000).toISOString().slice(0, 10);
    const customers = SEED_DEMO_USERS.filter((user) => user.role === "CUSTOMER");
    const qrSecret = process.env.QR_TOKEN_SECRET ?? "storex-dev-qr-secret";

    for (const [facilityIndex, facility] of facilityRows.entries()) {
      const manager =
        facilityIndex === 0
          ? SEED_USERS[2]
          : SEED_DEMO_USERS.find(
              (user) =>
                user.email ===
                `manager.hcm${String(facilityIndex + 1).padStart(2, "0")}@metastorage.test`,
            );
      const staff =
        facilityIndex === 0
          ? SEED_USERS[1]
          : SEED_DEMO_USERS.find(
              (user) =>
                user.email ===
                `staff.hcm${String(facilityIndex + 1).padStart(2, "0")}@metastorage.test`,
            );
      if (!manager || !staff) throw new Error(`Missing demo team for ${facility.code}`);
      for (const person of [manager, staff]) {
        await tx
          .insert(facilityAssignments)
          .values({ userId: person.id, facilityId: facility.id, role: person.role })
          .onConflictDoNothing();
      }
      const facilityTypes = typeRows.filter((type) => type.facilityId === facility.id);
      for (const type of facilityTypes) {
        const originalId = `71000000-0000-4000-8000-${facility.id.slice(-6)}${type.priceRangeId.slice(-6)}`;
        await tx
          .update(storageUnits)
          .set({ floor: "1", locationDescription: `Dãy A · ${type.sizeLabel} · Ô 01` })
          .where(eq(storageUnits.id, originalId));
        for (let serial = 2; serial <= 4; serial++) {
          await tx
            .insert(storageUnits)
            .values({
              id: id(
                "72000000",
                (facilityIndex + 1) * 1000 + facilityTypes.indexOf(type) * 10 + serial,
              ),
              facilityId: facility.id,
              unitTypeId: type.id,
              code: `${facility.code}-${type.code}-${String(serial).padStart(3, "0")}`,
              status: StorageUnitStatus.AVAILABLE,
              floor: serial < 4 ? "1" : "2",
              locationDescription: `Dãy ${serial < 4 ? "A" : "B"} · ${type.sizeLabel} · Ô ${String(serial).padStart(2, "0")}`,
            })
            .onConflictDoNothing();
        }
      }

      for (let scenario = 0; scenario < 3; scenario++) {
        const ordinal = facilityIndex * 3 + scenario + 1;
        const type = facilityTypes[(facilityIndex + scenario) % facilityTypes.length];
        const customer = customers[facilityIndex % customers.length];
        const slot = slots[scenario % slots.length];
        if (!type || !customer || !slot) throw new Error("Incomplete demo catalog");
        const date = new Date(`${today}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + 1 + (facilityIndex % 5));
        const checkInDate = date.toISOString().slice(0, 10);
        const start = new Date(`${checkInDate}T${slot.startTime}+07:00`);
        const rentalEndAt = new Date(start);
        const months = [1, 3, 6][scenario] ?? 1;
        rentalEndAt.setUTCMonth(rentalEndAt.getUTCMonth() + months);
        const bookingId = id("81000000", ordinal);
        const paid = scenario !== 2;
        const code = `DEMO-${facility.code}-${scenario === 0 ? "UNASSIGNED" : scenario === 1 ? "ASSIGNED" : "DRAFT"}`;
        const tokenHash = hash(hash(`local-seed:${bookingId}`));
        const qr = createHmac("sha256", qrSecret).update(bookingId).digest("hex");
        const row = {
          id: bookingId,
          reservationCode: paid ? code : null,
          customerId: customer.id,
          facilityId: facility.id,
          unitTypeId: type.id,
          requestedMonths: months,
          rentalEndAt,
          monthlyRateSnapshot: String(type.monthlyPrice),
          rentalFeeAmount: String(type.monthlyPrice * months),
          depositAmount: String(type.monthlyPrice),
          totalAmount: String(type.monthlyPrice * (months + 1)),
          status: paid ? ReservationStatus.CONFIRMED : ReservationStatus.DRAFT,
          qrTokenHash: paid ? hash(qr) : null,
        };
        await tx.insert(reservations).values(row).onConflictDoNothing();
        await saveCheckInAppointment(tx, {
          reservationId: bookingId,
          facilityId: facility.id,
          customerId: customer.id,
          contactPhone: paid ? `+84${customer.phone.slice(1)}` : null,
          scheduledDate: checkInDate,
          slotId: slot.id,
          createdBy: customer.id,
          status: paid ? AppointmentStatus.CONFIRMED : AppointmentStatus.SCHEDULED,
          assignedStaffId: scenario === 1 ? staff.id : null,
        });
        if (!paid) continue;
        await tx
          .insert(payments)
          .values({
            id: id("11000000", ordinal),
            reservationId: bookingId,
            holdTokenHash: tokenHash,
            provider: "MOCK",
            providerPaymentId: `local-seed:${bookingId}`,
            idempotencyKey: `local-seed:${bookingId}`,
            paymentCode: `DEMO${String(ordinal).padStart(6, "0")}`,
            totalAmount: row.totalAmount,
            currency: "VND",
            status: PaymentStatus.SUCCEEDED,
            paidAt: seedNow,
          })
          .onConflictDoNothing();
        await tx
          .insert(capacityAllocations)
          .values({
            id: id("a1000000", ordinal),
            facilityId: facility.id,
            unitTypeId: type.id,
            referenceId: bookingId,
            kind: CapacityAllocationKind.BOOKING,
            status: CapacityAllocationStatus.ACTIVE,
            startsAt: start,
            endsAt: rentalEndAt,
          })
          .onConflictDoNothing();
        if (scenario === 1) {
          const [unit] = await tx
            .select()
            .from(storageUnits)
            .where(
              and(
                eq(storageUnits.facilityId, facility.id),
                eq(storageUnits.unitTypeId, type.id),
                eq(storageUnits.code, `${facility.code}-${type.code}-002`),
              ),
            );
          if (!unit) throw new Error(`Missing assignment unit for ${code}`);
          await tx
            .insert(unitAssignments)
            .values({
              id: id("b1000000", ordinal),
              reservationId: bookingId,
              physicalUnitId: unit.id,
              assignedBy: manager.id,
              status: "ACTIVE",
              reason: "Local demo: prepared booking",
            })
            .onConflictDoNothing();
          await tx
            .update(storageUnits)
            .set({ status: StorageUnitStatus.RESERVED })
            .where(
              and(
                eq(storageUnits.id, unit.id),
                eq(storageUnits.status, StorageUnitStatus.AVAILABLE),
              ),
            );
        }
      }
    }

    // One paid, unassigned booking for the full FM → Staff → handover Swagger flow.
    const flow2Facility = facilityRows.find(
      (facility) => facility.id === SEED_IDS.facilities["HCM-01"],
    );
    const flow2Type = typeRows.find((type) => type.id === SEED_IDS.unitTypes["UT-2M"]);
    const flow2Slot = slots[0];
    if (!flow2Facility || !flow2Type || !flow2Slot)
      throw new Error("Missing Flow 2 demo facility, unit type or check-in slot");
    const flow2BookingId = id("83000000", 1);
    const flow2Start = new Date(`${today}T${flow2Slot.startTime}+07:00`);
    const flow2End = new Date(flow2Start);
    flow2End.setUTCMonth(flow2End.getUTCMonth() + 1);
    const flow2TokenHash = hash(hash(`local-seed:${flow2BookingId}`));
    await tx
      .insert(reservations)
      .values({
        id: flow2BookingId,
        reservationCode: "DEMO-FLOW2-READY",
        customerId: SEED_USERS[0].id,
        facilityId: flow2Facility.id,
        unitTypeId: flow2Type.id,
        requestedMonths: 1,
        rentalEndAt: flow2End,
        monthlyRateSnapshot: String(flow2Type.monthlyPrice),
        rentalFeeAmount: String(flow2Type.monthlyPrice),
        depositAmount: String(flow2Type.monthlyPrice),
        totalAmount: String(flow2Type.monthlyPrice * 2),
        qrTokenHash: hash(createHmac("sha256", qrSecret).update(flow2BookingId).digest("hex")),
        status: ReservationStatus.CONFIRMED,
      })
      .onConflictDoNothing();
    await saveCheckInAppointment(tx, {
      reservationId: flow2BookingId,
      facilityId: flow2Facility.id,
      customerId: SEED_USERS[0].id,
      contactPhone: `+84${SEED_USERS[0].phone.slice(1)}`,
      scheduledDate: today,
      slotId: flow2Slot.id,
      createdBy: SEED_USERS[0].id,
      status: AppointmentStatus.CONFIRMED,
    });
    await tx
      .insert(payments)
      .values({
        id: id("13000000", 1),
        reservationId: flow2BookingId,
        holdTokenHash: flow2TokenHash,
        provider: "MOCK",
        providerPaymentId: `local-seed:${flow2BookingId}`,
        idempotencyKey: `local-seed:${flow2BookingId}`,
        paymentCode: "DEMO-FLOW2-PAID",
        totalAmount: String(flow2Type.monthlyPrice * 2),
        currency: "VND",
        status: PaymentStatus.SUCCEEDED,
        paidAt: seedNow,
      })
      .onConflictDoNothing();
    await tx
      .insert(capacityAllocations)
      .values({
        id: id("a4000000", 1),
        facilityId: flow2Facility.id,
        unitTypeId: flow2Type.id,
        referenceId: flow2BookingId,
        kind: CapacityAllocationKind.BOOKING,
        status: CapacityAllocationStatus.ACTIVE,
        startsAt: flow2Start,
        endsAt: flow2End,
      })
      .onConflictDoNothing();

    // Keep the original Swagger IDs usable for check-in and snapshot-based capacity.
    const originals = await tx
      .select()
      .from(reservations)
      .where(inArray(reservations.id, Object.values(SEED_IDS.reservations)));
    for (const [index, booking] of originals.entries()) {
      const [appointment] = await tx
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.reservationId, booking.id),
            eq(appointments.appointmentType, AppointmentType.CHECK_IN),
          ),
        );
      const slot = slots.find((slot) => slot.id === appointment?.slotId);
      if (!appointment || !slot) throw new Error("Missing original seed appointment or slot");
      const start = new Date(`${appointment.scheduledDate}T${slot.startTime}+07:00`);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + booking.requestedMonths);
      await tx
        .update(reservations)
        .set({
          rentalEndAt: end,
          qrTokenHash: hash(createHmac("sha256", qrSecret).update(booking.id).digest("hex")),
        })
        .where(eq(reservations.id, booking.id));
      await saveCheckInAppointment(tx, {
        reservationId: booking.id,
        facilityId: booking.facilityId,
        customerId: booking.customerId,
        contactPhone: appointment.contactPhone,
        scheduledDate: appointment.scheduledDate,
        slotId: appointment.slotId,
        createdBy: booking.customerId,
        status:
          booking.status === ReservationStatus.CANCELLED
            ? AppointmentStatus.CANCELLED
            : booking.status === ReservationStatus.NO_SHOW
              ? AppointmentStatus.NO_SHOW
              : booking.status === ReservationStatus.CHECKED_IN
                ? AppointmentStatus.COMPLETED
                : booking.status === ReservationStatus.CONFIRMED
                  ? AppointmentStatus.CONFIRMED
                  : AppointmentStatus.SCHEDULED,
        assignedStaffId: booking.status === ReservationStatus.CONFIRMED ? SEED_USERS[1].id : null,
      });
      if (booking.status === "CONFIRMED") {
        const [assignment] = await tx
          .select({ physicalUnitId: unitAssignments.physicalUnitId })
          .from(unitAssignments)
          .where(
            and(
              eq(unitAssignments.reservationId, booking.id),
              eq(unitAssignments.status, "ACTIVE"),
            ),
          );
        if (assignment)
          await tx
            .update(storageUnits)
            .set({ status: StorageUnitStatus.RESERVED })
            .where(
              and(
                eq(storageUnits.id, assignment.physicalUnitId),
                eq(storageUnits.status, StorageUnitStatus.AVAILABLE),
              ),
            );
        await tx
          .insert(capacityAllocations)
          .values({
            id: id("a2000000", index + 1),
            facilityId: booking.facilityId,
            unitTypeId: booking.unitTypeId,
            referenceId: booking.id,
            kind: CapacityAllocationKind.BOOKING,
            status: CapacityAllocationStatus.ACTIVE,
            startsAt: start,
            endsAt: end,
          })
          .onConflictDoNothing();
      } else if (booking.status === "NO_SHOW") {
        await tx
          .update(payments)
          .set({
            status: PaymentStatus.REFUND_PENDING,
            refundReason: PaymentRefundReason.NO_SHOW,
            refundAmount: booking.rentalFeeAmount,
            depositForfeitedAmount: booking.depositAmount,
          })
          .where(eq(payments.reservationId, booking.id));
      }
    }
    const facilityId = SEED_IDS.facilities["HCM-01"];
    const type = typeRows.find((type) => type.id === SEED_IDS.unitTypes["UT-1M"]);
    const slot = slots[0];
    if (!type || !slot) throw new Error("Missing payment-demo catalog");
    for (const [index, scenario] of [
      "PENDING_HOLD",
      "EXPIRED_HOLD",
      "FAILED_PAYMENT",
      "CANCELLED_REFUND",
    ].entries()) {
      const bookingId = id("82000000", index + 1);
      const date = new Date(`${today}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + 2);
      const checkInDate = date.toISOString().slice(0, 10);
      const start = new Date(`${checkInDate}T${slot.startTime}+07:00`);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 2);
      const tokenHash = hash(hash(`local-seed:${bookingId}`));
      const cancelled = scenario === "CANCELLED_REFUND";
      await tx
        .insert(reservations)
        .values({
          id: bookingId,
          reservationCode: cancelled ? `DEMO-${scenario}` : null,
          customerId: SEED_USERS[0].id,
          facilityId,
          unitTypeId: type.id,
          requestedMonths: 2,
          rentalEndAt: end,
          monthlyRateSnapshot: String(type.monthlyPrice),
          rentalFeeAmount: String(type.monthlyPrice * 2),
          depositAmount: String(type.monthlyPrice),
          totalAmount: String(type.monthlyPrice * 3),
          status: cancelled ? ReservationStatus.CANCELLED : ReservationStatus.DRAFT,
        })
        .onConflictDoNothing();
      await saveCheckInAppointment(tx, {
        reservationId: bookingId,
        facilityId,
        customerId: SEED_USERS[0].id,
        contactPhone: `+84${SEED_USERS[0].phone.slice(1)}`,
        scheduledDate: checkInDate,
        slotId: slot.id,
        createdBy: SEED_USERS[0].id,
        status: cancelled ? AppointmentStatus.CANCELLED : AppointmentStatus.SCHEDULED,
      });
      await tx
        .insert(payments)
        .values({
          id: id("12000000", index + 1),
          reservationId: bookingId,
          holdTokenHash: tokenHash,
          provider: "MOCK",
          providerPaymentId: `local-seed:${bookingId}`,
          idempotencyKey: `local-seed:${bookingId}`,
          paymentCode: `DEMO-PAY-${index + 1}`,
          totalAmount: String(type.monthlyPrice * 3),
          currency: "VND",
          status: cancelled
            ? PaymentStatus.REFUND_PENDING
            : scenario === "FAILED_PAYMENT"
              ? PaymentStatus.FAILED
              : PaymentStatus.PENDING,
          paidAt: cancelled ? seedNow : null,
          refundReason: cancelled ? PaymentRefundReason.CUSTOMER_CANCELLATION : null,
          refundAmount: cancelled ? String(type.monthlyPrice * 2) : null,
          depositForfeitedAmount: cancelled ? String(type.monthlyPrice) : "0",
        })
        .onConflictDoNothing();
      if (index < 2) {
        await tx
          .insert(capacityAllocations)
          .values({
            id: id("a3000000", index + 1),
            facilityId,
            unitTypeId: type.id,
            referenceId: bookingId,
            accessTokenHash: tokenHash,
            kind: CapacityAllocationKind.HOLD,
            status:
              index === 0 ? CapacityAllocationStatus.ACTIVE : CapacityAllocationStatus.EXPIRED,
            startsAt: start,
            endsAt: end,
            expiresAt: new Date(seedNow.getTime() + (index === 0 ? 600000 : -60000)),
          })
          .onConflictDoNothing();
      }
    }
    // There is no active Rental for this legacy fixture; do not seed phantom occupancy.
    await tx
      .update(storageUnits)
      .set({ status: StorageUnitStatus.AVAILABLE })
      .where(eq(storageUnits.id, SEED_IDS.storageUnits["HCM-01-006"]));
    for (const code of Object.keys(SEED_IDS.storageUnits)) {
      await tx
        .update(storageUnits)
        .set({ floor: "1", locationDescription: `Khu demo bàn giao · ${code}` })
        .where(eq(storageUnits.code, code));
    }
    return today;
  });
  console.log(
    "Core demo ready: 10 facilities, 8 types, 328 units, 29 users, 38 reservations, paid/pending/failed/refund/expired-hold scenarios.",
  );
  console.log(
    `Flow 2 Swagger booking: DEMO-FLOW2-READY (${id("83000000", 1)}), check-in ${flow2CheckInDate}.`,
  );
}

function shiftDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function localDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function seedFlow2Demo(seedNow: Date) {
  const password = await hashPassword(FLOW2_STAFF_PASSWORD);
  await db.transaction(async (tx) => {
    const [facility] = await tx.select().from(facilities).where(eq(facilities.code, "HCM-01"));
    if (!facility) throw new Error("HCM-01 facility is required for Flow 2 demo data");
    const [staff] = await tx
      .insert(users)
      .values({
        id: FLOW2_STAFF_ID,
        email: FLOW2_STAFF_EMAIL,
        name: "Trần Quốc Huy (Flow 2 demo)",
        role: UserRole.FACILITY_STAFF,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          email: FLOW2_STAFF_EMAIL,
          role: UserRole.FACILITY_STAFF,
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      })
      .returning();
    if (!staff) throw new Error("Flow 2 staff fixture could not be created");
    await tx
      .insert(facilityAssignments)
      .values({
        userId: staff.id,
        facilityId: facility.id,
        role: UserRole.FACILITY_STAFF,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [facilityAssignments.userId, facilityAssignments.facilityId],
        set: { isActive: true, endedAt: null },
      });
    const [credential] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, staff.id), eq(accounts.providerId, "credential")));
    if (credential) {
      await tx
        .update(accounts)
        .set({ password, updatedAt: seedNow })
        .where(eq(accounts.id, credential.id));
    } else {
      await tx.insert(accounts).values({
        id: `credential-${staff.id}`,
        userId: staff.id,
        accountId: staff.id,
        providerId: "credential",
        password,
      });
    }
    const codes = [
      "UT-2M",
      "UT-2M",
      "UT-2M",
      "UT-4M",
      "UT-4M",
      "UT-4M",
      "UT-6M",
      "UT-6M",
      "UT-AC-4M",
      "UT-AC-4M",
    ];
    for (const [index, typeCode] of codes.entries()) {
      const [type] = await tx
        .select()
        .from(unitTypes)
        .where(and(eq(unitTypes.code, typeCode), eq(unitTypes.facilityId, facility.id)));
      if (!type) throw new Error(`Missing active unit type ${typeCode}`);
      const code = `HCM-01-${String(index + 9).padStart(3, "0")}`;
      await tx
        .insert(storageUnits)
        .values({
          id: id("72000000", index + 1),
          code,
          facilityId: facility.id,
          unitTypeId: type.id,
          status: StorageUnitStatus.AVAILABLE,
          floor: "Tầng trệt",
          locationDescription: `Khu demo Flow 2 · ${code}`,
        })
        .onConflictDoNothing({ target: storageUnits.code });
    }
  });
}

async function seedFlow3Rentals(seedNow: Date) {
  const [facility] = await db.select().from(facilities).where(eq(facilities.code, "HCM-01"));
  if (!facility) throw new Error("HCM-01 is required for return seed data");
  const [type] = await db
    .select()
    .from(unitTypes)
    .where(and(eq(unitTypes.code, "UT-2M"), eq(unitTypes.facilityId, facility.id)));
  const [customer, staff, manager] = SEED_USERS;
  if (!facility || !type || !customer || !staff || !manager)
    throw new Error("Flow 3 fixture prerequisites are missing");
  const slots = await db.select().from(checkInSlots).orderBy(asc(checkInSlots.startTime));
  if (slots.length < 3) throw new Error("At least three shared return/check-in slots are required");
  const definitions = [
    {
      status: RentalStatus.ACTIVE,
      expiryDays: 20,
      requestStatus: null,
      requestDay: 2,
      slotIndex: 0,
    },
    {
      status: RentalStatus.RETURN_PENDING,
      expiryDays: 5,
      requestStatus: ReturnRequestStatus.PENDING,
      requestDay: 0,
      slotIndex: 1,
    },
    {
      status: RentalStatus.OVERDUE,
      expiryDays: -2,
      requestStatus: ReturnRequestStatus.CONFIRMED,
      requestDay: 0,
      slotIndex: 2,
    },
    {
      status: RentalStatus.CLOSED,
      expiryDays: -120,
      requestStatus: ReturnRequestStatus.COMPLETED,
      requestDay: -119,
      slotIndex: 0,
    },
    {
      status: RentalStatus.ACTIVE,
      expiryDays: 45,
      requestStatus: null,
      requestDay: 10,
      slotIndex: 1,
    },
    {
      status: RentalStatus.RETURN_PENDING,
      expiryDays: 12,
      requestStatus: ReturnRequestStatus.PENDING,
      requestDay: 0,
      slotIndex: 3,
    },
  ] as const;
  for (const [index, scenario] of definitions.entries()) {
    const bookingId = FLOW3_IDS.reservations[index];
    const rentalId = FLOW3_IDS.rentals[index];
    const unitId = FLOW3_IDS.units[index];
    const unitCode = `HCM-01-${String(index + 19).padStart(3, "0")}`;
    if (!bookingId || !rentalId || !unitId) continue;
    const startAt = shiftDays(seedNow, -30);
    const expectedEndAt = shiftDays(seedNow, scenario.expiryDays);
    const actualReturnAt = scenario.status === "CLOSED" ? shiftDays(expectedEndAt, 1) : null;
    const checkInDate = localDate(startAt);
    const bookingCode = FLOW3_BOOKING_CODES[index];
    await db.transaction(async (tx) => {
      const checkInSlot = slots[0];
      if (!checkInSlot) throw new Error("Flow 3 check-in slot fixture is missing");
      await tx
        .insert(storageUnits)
        .values({
          id: unitId,
          code: unitCode,
          facilityId: facility.id,
          unitTypeId: type.id,
          status:
            scenario.status === RentalStatus.CLOSED
              ? StorageUnitStatus.AVAILABLE
              : StorageUnitStatus.OCCUPIED,
          floor: "1",
          locationDescription: `Khu demo Flow 3 · ${unitCode}`,
        })
        .onConflictDoUpdate({
          target: storageUnits.id,
          set: {
            status:
              scenario.status === RentalStatus.CLOSED
                ? StorageUnitStatus.AVAILABLE
                : StorageUnitStatus.OCCUPIED,
          },
        });
      await tx
        .insert(reservations)
        .values({
          id: bookingId,
          reservationCode: bookingCode,
          customerId: customer.id,
          facilityId: facility.id,
          unitTypeId: type.id,
          requestedMonths: 1,
          rentalEndAt: expectedEndAt,
          monthlyRateSnapshot: String(type.monthlyPrice),
          rentalFeeAmount: String(type.monthlyPrice),
          depositAmount: String(type.monthlyPrice),
          totalAmount: String(type.monthlyPrice * 2),
          status: ReservationStatus.CHECKED_IN,
        })
        .onConflictDoUpdate({
          target: reservations.id,
          set: { status: ReservationStatus.CHECKED_IN, rentalEndAt: expectedEndAt },
        });
      await saveCheckInAppointment(tx, {
        reservationId: bookingId,
        facilityId: facility.id,
        customerId: customer.id,
        contactPhone: customer.phone,
        scheduledDate: checkInDate,
        slotId: checkInSlot.id,
        createdBy: customer.id,
        status: AppointmentStatus.COMPLETED,
        assignedStaffId: staff.id,
      });
      const paymentId = id("89000000", index + 1);
      await tx
        .insert(payments)
        .values({
          id: paymentId,
          reservationId: bookingId,
          holdTokenHash: `seed-${bookingId}`,
          provider: "MOCK",
          providerPaymentId: `seed-flow3-payment-${bookingId}`,
          idempotencyKey: `seed-flow3-${bookingId}`,
          paymentCode: `F3PAY${index + 1}`,
          totalAmount: String(type.monthlyPrice * 2),
          currency: "VND",
          status: PaymentStatus.SUCCEEDED,
          paidAt: startAt,
        })
        .onConflictDoNothing();
      await tx
        .insert(rentals)
        .values({
          id: rentalId,
          reservationId: bookingId,
          facilityId: facility.id,
          physicalUnitId: unitId,
          status: scenario.status,
          startAt,
          expectedEndAt,
          actualReturnAt,
          closedAt: actualReturnAt,
          returnStatus: scenario.requestStatus,
          returnReason: scenario.requestStatus ? "Demo Flow 3 return request" : null,
          depositAmount: String(type.monthlyPrice),
        })
        .onConflictDoUpdate({
          target: rentals.id,
          set: {
            status: scenario.status,
            expectedEndAt,
            actualReturnAt,
            closedAt: actualReturnAt,
            returnStatus: scenario.requestStatus,
            returnReason: scenario.requestStatus ? "Demo Flow 3 return request" : null,
          },
        });
      if (scenario.requestStatus) {
        const scheduledDate = localDate(shiftDays(seedNow, scenario.requestDay));
        const slot = slots[scenario.slotIndex];
        if (!slot) throw new Error("Flow 3 checkout slot fixture is missing");
        const [existingAppointment] = await tx
          .select({ id: appointments.id })
          .from(appointments)
          .where(
            and(
              eq(appointments.rentalId, rentalId),
              eq(appointments.appointmentType, AppointmentType.CHECK_OUT),
            ),
          );
        const appointmentValues = {
          facilityId: facility.id,
          appointmentType: AppointmentType.CHECK_OUT,
          scheduledDate,
          slotId: slot.id,
          customerId: customer.id,
          contactPhone: customer.phone,
          status:
            scenario.requestStatus === "CONFIRMED"
              ? AppointmentStatus.CONFIRMED
              : scenario.requestStatus === "COMPLETED"
                ? AppointmentStatus.COMPLETED
                : AppointmentStatus.SCHEDULED,
          rentalId,
          createdBy: customer.id,
          notes: "Demo Flow 3 return request",
        };
        if (existingAppointment) {
          await tx
            .update(appointments)
            .set(appointmentValues)
            .where(eq(appointments.id, existingAppointment.id));
        } else {
          await tx.insert(appointments).values(appointmentValues);
        }
      }
      await tx
        .insert(unitAssignments)
        .values({
          id: id("89100000", index + 1),
          reservationId: bookingId,
          physicalUnitId: unitId,
          assignedBy: manager.id,
          status: scenario.status === "CLOSED" ? "COMPLETED" : "ACTIVE",
          reason: "Demo Flow 3 rental fixture",
        })
        .onConflictDoUpdate({
          target: unitAssignments.id,
          set: {
            physicalUnitId: unitId,
            assignedBy: manager.id,
            status: scenario.status === "CLOSED" ? "COMPLETED" : "ACTIVE",
            reason: "Demo Flow 3 rental fixture",
          },
        });
      await tx
        .insert(capacityAllocations)
        .values({
          id: id("89200000", index + 1),
          facilityId: facility.id,
          unitTypeId: type.id,
          referenceId: bookingId,
          kind: CapacityAllocationKind.BOOKING,
          status:
            scenario.status === RentalStatus.CLOSED
              ? CapacityAllocationStatus.RELEASED
              : CapacityAllocationStatus.ACTIVE,
          startsAt: startAt,
          endsAt: expectedEndAt,
        })
        .onConflictDoUpdate({
          target: capacityAllocations.id,
          set: {
            status:
              scenario.status === RentalStatus.CLOSED
                ? CapacityAllocationStatus.RELEASED
                : CapacityAllocationStatus.ACTIVE,
            startsAt: startAt,
            endsAt: expectedEndAt,
          },
        });
    });
  }
}

export async function seedPricingPolicy(seedNow = getSeedNow()) {
  await db
    .insert(systemSettings)
    .values({
      key: SystemSettingKey.DEPOSIT_MONTHS,
      value: SYSTEM_SETTING_DEFINITIONS.DEPOSIT_MONTHS.defaultValue,
      description: SYSTEM_SETTING_DEFINITIONS.DEPOSIT_MONTHS.description,
      version: 1,
      updatedAt: seedNow,
    })
    .onConflictDoNothing();
}

async function seedPolicies(seedNow: Date) {
  await seedPricingPolicy(seedNow);
  const keys = [
    SystemSettingKey.EXPIRY_REMINDER_DAYS,
    SystemSettingKey.ABANDONED_REVIEW_DAYS,
    SystemSettingKey.OVERDUE_FEE_RATE,
    SystemSettingKey.OPENING_HOUR,
    SystemSettingKey.CLOSING_HOUR,
  ] as const;
  await db
    .insert(systemSettings)
    .values(
      keys.map((key) => ({
        key,
        value: SYSTEM_SETTING_DEFINITIONS[key].defaultValue,
        description: SYSTEM_SETTING_DEFINITIONS[key].description,
        version: 0,
        updatedAt: seedNow,
      })),
    )
    .onConflictDoNothing();
}

async function seedAuthAccounts(seedNow: Date) {
  const regularPassword = await hashPassword(DEV_AUTH_PASSWORD);
  const flow2Password = await hashPassword(FLOW2_STAFF_PASSWORD);
  const fixtures = [
    ...SEED_USERS.map((user) => ({ ...user, password: regularPassword })),
    ...SEED_DEMO_USERS.map((user) => ({ ...user, password: regularPassword })),
    { id: FLOW2_STAFF_ID, email: FLOW2_STAFF_EMAIL, password: flow2Password },
  ];
  await db.transaction(async (tx) => {
    for (const fixture of fixtures) {
      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, fixture.email));
      if (!user) continue;
      const [account] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")));
      if (account) {
        await tx
          .update(accounts)
          .set({ password: fixture.password, updatedAt: seedNow })
          .where(eq(accounts.id, account.id));
      } else {
        await tx.insert(accounts).values({
          id: `credential-${user.id}`,
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: fixture.password,
        });
      }
    }
  });
}

async function seed() {
  const nodeEnv = process.env.NODE_ENV ?? loadApiEnv().NODE_ENV;
  if (nodeEnv?.trim().toLowerCase() === "production")
    throw new Error("Local demo seeding is disabled in production");
  const seedNow = getSeedNow();
  console.log("Starting local database seeding via raw SQL client...");

  console.log("1. Seeding facilities...");
  // Fictional catalog fixtures for local testing, not real metastorage locations.
  const facilitiesData = [
    {
      id: SEED_IDS.facilities["HCM-01"],
      code: "HCM-01",
      name: "metastorage Sài Gòn Central",
      address: "118 Nguyễn Văn Linh",
    },
    {
      id: SEED_IDS.facilities["HCM-02"],
      code: "HCM-02",
      name: "metastorage Bến Thành",
      address: "42 Lê Lai",
    },
    {
      id: SEED_IDS.facilities["HCM-03"],
      code: "HCM-03",
      name: "metastorage Bình Thạnh",
      address: "85 Điện Biên Phủ",
    },
    {
      id: SEED_IDS.facilities["HCM-04"],
      code: "HCM-04",
      name: "metastorage Thảo Điền",
      address: "28 Nguyễn Văn Hưởng",
    },
    {
      id: SEED_IDS.facilities["HCM-05"],
      code: "HCM-05",
      name: "metastorage Phú Nhuận",
      address: "156 Phan Xích Long",
    },
    {
      id: SEED_IDS.facilities["HCM-06"],
      code: "HCM-06",
      name: "metastorage Tân Bình",
      address: "67 Cộng Hòa",
    },
    {
      id: SEED_IDS.facilities["HCM-07"],
      code: "HCM-07",
      name: "metastorage Tân Phú",
      address: "93 Lũy Bán Bích",
    },
    {
      id: SEED_IDS.facilities["HCM-08"],
      code: "HCM-08",
      name: "metastorage Gò Vấp",
      address: "210 Nguyễn Oanh",
    },
    {
      id: SEED_IDS.facilities["HCM-09"],
      code: "HCM-09",
      name: "metastorage Bình Tân",
      address: "134 Tên Lửa",
    },
    {
      id: SEED_IDS.facilities["HCM-10"],
      code: "HCM-10",
      name: "metastorage Thủ Đức",
      address: "55 Võ Văn Ngân",
    },
  ];
  const facilities = [];
  for (const facility of facilitiesData) {
    const [row] = await queryClient`
      INSERT INTO facilities (id, code, name, address, description, is_active)
      VALUES (
        ${facility.id}, ${facility.code}, ${facility.name}, ${`${facility.address}, TP. Hồ Chí Minh`},
        'Dữ liệu mẫu: kho lưu trữ cho gia đình và doanh nghiệp nhỏ, kiểm soát 24/7.', true
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        description = EXCLUDED.description,
        is_active = EXCLUDED.is_active
      RETURNING id, code, name
    `;
    if (!row) throw new Error(`Facility ${facility.code} was not created`);
    facilities.push(row);
  }
  const facHcm = facilities.find((facility) => facility.code === "HCM-01");

  if (!facHcm) throw new Error("HCM facility was not created");

  console.log("2. Seeding users...");
  for (const fixture of SEED_USERS) {
    await queryClient`
      INSERT INTO users (id, email, phone, name, role, status, email_verified)
      VALUES (${fixture.id}, ${fixture.email}, ${fixture.phone}, ${fixture.name}, ${fixture.role}, 'ACTIVE', true)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email, phone = EXCLUDED.phone, name = EXCLUDED.name,
        role = EXCLUDED.role, status = EXCLUDED.status, email_verified = EXCLUDED.email_verified
    `;
  }
  const [customer, staff, manager] = SEED_USERS;

  console.log("3. Seeding facility assignments...");
  for (const assignment of [
    { userId: manager.id, role: UserRole.FACILITY_MANAGER },
    { userId: staff.id, role: UserRole.FACILITY_STAFF },
  ]) {
    await queryClient`
      INSERT INTO facility_assignments (id, user_id, facility_id, role, is_active)
      VALUES (${`90000000-0000-4000-8000-${assignment.userId.slice(-12)}`}, ${assignment.userId}, ${facHcm.id}, ${assignment.role}, true)
      ON CONFLICT (user_id, facility_id) DO UPDATE SET
        is_active = true,
        role = EXCLUDED.role,
        ended_at = null
    `;
  }

  console.log("4. Seeding unit types...");
  // Dimensions below are fictional seed fixtures, not measured facility inventory.
  const unitTypesData = [
    {
      id: SEED_IDS.unitTypes["UT-2M"],
      code: "UT-2M",
      name: "Kho tiêu chuẩn (2 m²)",
      sizeLabel: "2 m²",
      lengthM: 2,
      widthM: 1,
      heightM: 2.5,
      monthlyPrice: 900000,
    },
    {
      id: SEED_IDS.unitTypes["UT-4M"],
      code: "UT-4M",
      name: "Kho tiêu chuẩn (4 m²)",
      sizeLabel: "4 m²",
      lengthM: 2,
      widthM: 2,
      heightM: 2.5,
      monthlyPrice: 1500000,
    },
    {
      id: SEED_IDS.unitTypes["UT-6M"],
      code: "UT-6M",
      name: "Kho tiêu chuẩn (6 m²)",
      sizeLabel: "6 m²",
      lengthM: 3,
      widthM: 2,
      heightM: 2.5,
      monthlyPrice: 2100000,
    },
    {
      id: SEED_IDS.unitTypes["UT-AC-4M"],
      code: "UT-AC-4M",
      name: "Kho kiểm soát ẩm (4 m²)",
      sizeLabel: "4 m² - kiểm soát ẩm",
      lengthM: 2,
      widthM: 2,
      heightM: 2.5,
      monthlyPrice: 1900000,
    },
    {
      id: SEED_IDS.unitTypes["UT-1M"],
      code: "UT-1M",
      name: "Kho tiêu chuẩn (1 m²)",
      sizeLabel: "1 m²",
      lengthM: 1,
      widthM: 1,
      heightM: 2.5,
      monthlyPrice: 500000,
    },
    {
      id: SEED_IDS.unitTypes["UT-8M"],
      code: "UT-8M",
      name: "Kho tiêu chuẩn (8 m²)",
      sizeLabel: "8 m²",
      lengthM: 4,
      widthM: 2,
      heightM: 2.5,
      monthlyPrice: 2700000,
    },
    {
      id: SEED_IDS.unitTypes["UT-10M"],
      code: "UT-10M",
      name: "Kho tiêu chuẩn (10 m²)",
      sizeLabel: "10 m²",
      lengthM: 5,
      widthM: 2,
      heightM: 2.5,
      monthlyPrice: 3300000,
    },
    {
      id: SEED_IDS.unitTypes["UT-15M"],
      code: "UT-15M",
      name: "Kho tiêu chuẩn (15 m²)",
      sizeLabel: "15 m²",
      lengthM: 5,
      widthM: 3,
      heightM: 2.5,
      monthlyPrice: 4800000,
    },
  ];

  const typeMap = new Map<string, string>();
  for (const [index, unitType] of unitTypesData.entries()) {
    // Demo-only bounds: allow FM price changes around each fictional catalog price.
    const minMonthlyPrice = Math.floor(unitType.monthlyPrice * 0.8);
    const maxMonthlyPrice = Math.ceil(unitType.monthlyPrice * 1.2);
    await db
      .insert(rentalPriceRanges)
      .values({
        id: id("61000000", index + 1),
        code: unitType.code,
        name: unitType.name,
        minMonthlyPrice,
        maxMonthlyPrice,
      })
      .onConflictDoUpdate({
        target: rentalPriceRanges.code,
        set: { minMonthlyPrice, maxMonthlyPrice },
        setWhere: and(
          isNull(rentalPriceRanges.minMonthlyPrice),
          isNull(rentalPriceRanges.maxMonthlyPrice),
          eq(rentalPriceRanges.version, 0),
          isNull(rentalPriceRanges.updatedBy),
          eq(rentalPriceRanges.isActive, true),
          notExists(
            db
              .select({ id: unitTypes.id })
              .from(unitTypes)
              .where(
                and(
                  eq(unitTypes.priceRangeId, rentalPriceRanges.id),
                  or(
                    lt(unitTypes.monthlyPrice, minMonthlyPrice),
                    gt(unitTypes.monthlyPrice, maxMonthlyPrice),
                  ),
                ),
              ),
          ),
        ),
      });
    const [range] = await db
      .select({ id: rentalPriceRanges.id })
      .from(rentalPriceRanges)
      .where(eq(rentalPriceRanges.code, unitType.code));
    if (!range) throw new Error(`Missing seed range ${unitType.code}`);
    for (const [facilityIndex, facility] of facilities.entries()) {
      const candidateId =
        facilityIndex === 0 ? unitType.id : id("62000000", facilityIndex * 100 + index + 1);
      await db
        .insert(unitTypes)
        .values({ ...unitType, id: candidateId, facilityId: facility.id, priceRangeId: range.id })
        .onConflictDoNothing();
      const [localType] = await db
        .select({ id: unitTypes.id })
        .from(unitTypes)
        .where(and(eq(unitTypes.facilityId, facility.id), eq(unitTypes.code, unitType.code)));
      if (!localType) throw new Error(`Missing seed type ${facility.code}/${unitType.code}`);
      if (facilityIndex === 0) typeMap.set(unitType.code, localType.id);
      await db
        .insert(storageUnits)
        .values({
          id: `71000000-0000-4000-8000-${facility.id.slice(-6)}${unitType.id.slice(-6)}`,
          facilityId: facility.id,
          unitTypeId: localType.id,
          code: `${facility.code}-${unitType.code}-001`,
          status: StorageUnitStatus.AVAILABLE,
        })
        .onConflictDoNothing({ target: storageUnits.code });
    }
  }

  console.log("5. Seeding storage units...");
  const storageUnitsData = [
    {
      id: SEED_IDS.storageUnits["HCM-01-001"],
      code: "HCM-01-001",
      typeCode: "UT-2M",
      status: StorageUnitStatus.AVAILABLE,
    },
    {
      id: SEED_IDS.storageUnits["HCM-01-002"],
      code: "HCM-01-002",
      typeCode: "UT-2M",
      status: StorageUnitStatus.AVAILABLE,
    },
    {
      id: SEED_IDS.storageUnits["HCM-01-003"],
      code: "HCM-01-003",
      typeCode: "UT-4M",
      status: StorageUnitStatus.AVAILABLE,
    },
    {
      id: SEED_IDS.storageUnits["HCM-01-004"],
      code: "HCM-01-004",
      typeCode: "UT-4M",
      status: StorageUnitStatus.AVAILABLE,
    },
    {
      id: SEED_IDS.storageUnits["HCM-01-005"],
      code: "HCM-01-005",
      typeCode: "UT-6M",
      status: StorageUnitStatus.AVAILABLE,
    },
    {
      id: SEED_IDS.storageUnits["HCM-01-006"],
      code: "HCM-01-006",
      typeCode: "UT-6M",
      status: StorageUnitStatus.OCCUPIED,
    },
    {
      id: SEED_IDS.storageUnits["HCM-01-007"],
      code: "HCM-01-007",
      typeCode: "UT-AC-4M",
      status: StorageUnitStatus.MAINTENANCE,
    },
    {
      id: SEED_IDS.storageUnits["HCM-01-008"],
      code: "HCM-01-008",
      typeCode: "UT-AC-4M",
      status: StorageUnitStatus.INSPECTION,
    },
  ];

  const unitMap = new Map<string, string>();
  for (const storageUnit of storageUnitsData) {
    const typeId = typeMap.get(storageUnit.typeCode);
    if (!typeId) continue;

    const [row] = await queryClient`
      INSERT INTO storage_units (id, facility_id, unit_type_id, code, status)
      VALUES (${storageUnit.id}, ${facHcm.id}, ${typeId}, ${storageUnit.code}, ${storageUnit.status})
      ON CONFLICT (id) DO UPDATE SET
        facility_id = EXCLUDED.facility_id,
        unit_type_id = EXCLUDED.unit_type_id,
        status = EXCLUDED.status
      RETURNING id, code
    `;
    if (row) unitMap.set(row.code, row.id);
  }

  console.log("6. Seeding check-in slots...");
  const checkInSlotsData = [
    {
      id: SEED_IDS.checkInSlots[0],
      name: "Ca demo hôm nay",
      startTime: "07:00:00",
      endTime: "20:00:00",
    },
    {
      id: SEED_IDS.checkInSlots[1],
      name: "Ca 2",
      startTime: "10:30:00",
      endTime: "12:00:00",
    },
    {
      id: SEED_IDS.checkInSlots[2],
      name: "Ca 3",
      startTime: "14:00:00",
      endTime: "15:30:00",
    },
    {
      id: SEED_IDS.checkInSlots[3],
      name: "Ca 4",
      startTime: "15:30:00",
      endTime: "17:00:00",
    },
  ];
  for (const slot of checkInSlotsData) {
    await queryClient`
      INSERT INTO check_in_slots (id, name, start_time, end_time)
      VALUES (${slot.id}, ${slot.name}, ${slot.startTime}, ${slot.endTime})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name,
        start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time
    `;
  }

  console.log("7. Seeding reservations, payments and assignments...");
  const now = seedNow.getTime();
  const bookingData = [
    {
      id: SEED_IDS.reservations["BK-2026-0001"],
      code: "BK-2026-0001",
      scenario: "CONFIRMED_TODAY",
      typeCode: "UT-2M",
      assignCode: "HCM-01-001",
      contactPhone: "0900000001",
      months: 1,
      monthlyRate: 900000,
      status: "CONFIRMED",
      // Eligibility depends on the fixed slot and grace period, not seed time.
      dayOffset: 0,
      slotIndex: 0,
      paidOffset: -2 * HOUR_MS,
      paymentStatus: "SUCCEEDED",
    },
    {
      id: SEED_IDS.reservations["BK-2026-0002"],
      code: "BK-2026-0002",
      scenario: "TOO_EARLY",
      typeCode: "UT-4M",
      assignCode: "HCM-01-004",
      contactPhone: "0988776655",
      months: 3,
      monthlyRate: 1500000,
      status: "CONFIRMED",
      // The booking is prepared, but the customer must wait until tomorrow.
      dayOffset: 1,
      slotIndex: 1,
      paidOffset: -6 * HOUR_MS,
      paymentStatus: "SUCCEEDED",
    },
    {
      id: SEED_IDS.reservations["BK-2026-0003"],
      code: "BK-2026-0003",
      scenario: "NO_SHOW",
      typeCode: "UT-6M",
      assignCode: null,
      contactPhone: "0903112233",
      months: 6,
      monthlyRate: 2100000,
      // This fixture represents the terminal state after the grace period.
      status: "NO_SHOW",
      dayOffset: -1,
      slotIndex: 2,
      paidOffset: -24 * HOUR_MS,
      paymentStatus: "SUCCEEDED",
    },
  ];

  for (const bookingSeed of bookingData) {
    const typeId = typeMap.get(bookingSeed.typeCode);
    if (!typeId) continue;

    const slot = checkInSlotsData[bookingSeed.slotIndex];
    if (!slot) throw new Error(`Check-in slot for ${bookingSeed.code} was not found`);
    const checkInDate = new Date(now + bookingSeed.dayOffset * DAY_MS + 7 * HOUR_MS)
      .toISOString()
      .slice(0, 10);
    const checkInSlotStart = new Date(`${checkInDate}T${slot.startTime}+07:00`);
    const slotId = slot.id;
    const rentalEndAt = new Date(checkInSlotStart.getTime() + bookingSeed.months * 30 * DAY_MS);
    const rentalFeeAmount = bookingSeed.monthlyRate * bookingSeed.months;
    const depositAmount = bookingSeed.monthlyRate;
    const totalAmount = rentalFeeAmount + depositAmount;
    const suffix = bookingSeed.code.slice(-4).padStart(12, "0");
    const paymentId = `10000000-0000-4000-8000-${suffix}`;

    const [booking] = await queryClient`
      INSERT INTO reservations (
        id, reservation_code, customer_id,
        facility_id, unit_type_id, requested_months,
        rental_end_at, monthly_rate_snapshot, rental_fee_amount, deposit_amount, total_amount,
        status
      )
      VALUES (
        ${bookingSeed.id}, ${bookingSeed.code}, ${customer.id},
        ${facHcm.id}, ${typeId}, ${bookingSeed.months},
        ${rentalEndAt.toISOString()},
        ${bookingSeed.monthlyRate}, ${rentalFeeAmount}, ${depositAmount}, ${totalAmount},
        ${bookingSeed.status}
      )
      ON CONFLICT (id) DO UPDATE SET
        reservation_code = EXCLUDED.reservation_code,
        customer_id = EXCLUDED.customer_id,
        facility_id = EXCLUDED.facility_id,
        unit_type_id = EXCLUDED.unit_type_id,
        requested_months = EXCLUDED.requested_months,
        rental_end_at = EXCLUDED.rental_end_at,
        monthly_rate_snapshot = EXCLUDED.monthly_rate_snapshot,
        rental_fee_amount = EXCLUDED.rental_fee_amount,
        deposit_amount = EXCLUDED.deposit_amount,
        total_amount = EXCLUDED.total_amount,
        status = EXCLUDED.status,
        updated_at = ${seedNow.toISOString()}
      RETURNING id
    `;

    if (!booking) continue;

    const appointmentStatus = bookingSeed.status === "NO_SHOW" ? "NO_SHOW" : bookingSeed.status;
    await queryClient`
      INSERT INTO appointments (
        reservation_id, facility_id, appointment_type, scheduled_date, slot_id,
        status, customer_id, contact_phone, created_by, assigned_staff_id
      )
      VALUES (
        ${booking.id}, ${facHcm.id}, 'CHECK_IN', ${checkInDate}, ${slotId},
        ${appointmentStatus === "NO_SHOW" ? "NO_SHOW" : "CONFIRMED"}, ${customer.id},
        ${bookingSeed.contactPhone}, ${customer.id},
        ${bookingSeed.assignCode ? manager.id : null}
      )
      ON CONFLICT (reservation_id) WHERE appointment_type = 'CHECK_IN'
      DO UPDATE SET scheduled_date = EXCLUDED.scheduled_date,
        slot_id = EXCLUDED.slot_id, status = EXCLUDED.status,
        customer_id = EXCLUDED.customer_id, contact_phone = EXCLUDED.contact_phone,
        assigned_staff_id = EXCLUDED.assigned_staff_id, updated_at = ${seedNow.toISOString()}
    `;

    await queryClient`
      INSERT INTO payments (
        id, reservation_id, hold_token_hash, provider, provider_payment_id,
        idempotency_key, payment_code, total_amount,
        currency, status, paid_at
      )
      VALUES (
        ${paymentId}, ${booking.id}, ${`seed-hold-${bookingSeed.code}`},
        'MOCK', ${`seed-payment-${bookingSeed.code}`}, ${`seed-idempotency-${bookingSeed.code}`}, ${`SEED${bookingSeed.code}`},
        ${totalAmount}, 'VND',
        ${bookingSeed.paymentStatus}, ${new Date(now + bookingSeed.paidOffset).toISOString()}
      )
      ON CONFLICT (id) DO UPDATE SET
        reservation_id = EXCLUDED.reservation_id,
        payment_code = EXCLUDED.payment_code,
        status = EXCLUDED.status,
        paid_at = EXCLUDED.paid_at,
        updated_at = ${seedNow.toISOString()}
    `;

    // A rerun restores a clean scenario after manual check-in experiments.
    await queryClient`DELETE FROM checkin_verifications WHERE reservation_id = ${booking.id}`;
    await queryClient`DELETE FROM unit_assignments WHERE reservation_id = ${booking.id}`;

    if (bookingSeed.assignCode) {
      const physicalUnitId = unitMap.get(bookingSeed.assignCode);
      if (physicalUnitId) {
        await queryClient`
          INSERT INTO unit_assignments (id, reservation_id, physical_unit_id, assigned_by, status, reason)
          VALUES (
            ${`b0000000-0000-4000-8000-${booking.id.slice(-12)}`}, ${booking.id}, ${physicalUnitId}, ${manager.id}, 'ACTIVE',
            ${`Seed scenario: ${bookingSeed.scenario}`}
          )
        `;
      }
    }

    console.log(`   - ${bookingSeed.code}: ${bookingSeed.scenario}`);
  }

  await seedDemoData(seedNow);
  await seedFlow2Demo(seedNow);
  await seedFlow3Rentals(seedNow);
  await seedPolicies(seedNow);
  await seedAuthAccounts(seedNow);
  await seedImmediateCheckInSlot(seedNow);
  console.log("✅ Seeding completed successfully!");
  await queryClient.end();
}

// API bundles import fixture metadata; only the seed script may execute this entry point.
if (import.meta.main && process.argv[1]?.replaceAll("\\", "/").endsWith("/seed.ts")) {
  seed().catch(async (err) => {
    console.error("❌ Seeding failed:", err);
    await queryClient.end();
    process.exit(1);
  });
}
