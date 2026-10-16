import { createHash, createHmac } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import {
  bookings,
  capacityAllocations,
  checkInSlots,
  facilities,
  facilityAssignments,
  facilityOperatingHours,
  payments,
  storageUnits,
  unitAssignments,
  unitTypes,
  users,
} from "./schema";
import { SEED_DEMO_USERS, SEED_IDS, SEED_USERS } from "./seed-fixtures";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const id = (prefix: string, ordinal: number) =>
  `${prefix}-0000-4000-8000-${String(ordinal).padStart(12, "0")}`;

// Fictional local fixtures only. No provider checkout, webhook or email is sent.
export async function seedDemoData() {
  await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values(
        SEED_DEMO_USERS.map((user) => ({
          ...user,
          emailVerified: true,
          status: "ACTIVE" as const,
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
      .where(inArray(unitTypes.id, Object.values(SEED_IDS.unitTypes)))
      .orderBy(asc(unitTypes.code));
    const slots = await tx
      .select()
      .from(checkInSlots)
      .where(inArray(checkInSlots.id, [...SEED_IDS.checkInSlots]))
      .orderBy(asc(checkInSlots.startTime));
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
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
      for (let day = 0; day < 7; day++) {
        await tx
          .insert(facilityOperatingHours)
          .values({
            facilityId: facility.id,
            dayOfWeek: day,
            openTime: "08:00:00",
            closeTime: "20:00:00",
            timezone: "Asia/Ho_Chi_Minh",
          })
          .onConflictDoUpdate({
            target: [facilityOperatingHours.facilityId, facilityOperatingHours.dayOfWeek],
            set: { openTime: "08:00:00", closeTime: "20:00:00" },
          });
      }
      for (const type of typeRows) {
        const originalId = `71000000-0000-4000-8000-${facility.id.slice(-6)}${type.id.slice(-6)}`;
        await tx
          .update(storageUnits)
          .set({ floor: "1", locationDescription: `Dãy A · ${type.sizeLabel} · Ô 01` })
          .where(eq(storageUnits.id, originalId));
        for (let serial = 2; serial <= 4; serial++) {
          await tx
            .insert(storageUnits)
            .values({
              id: id("72000000", (facilityIndex + 1) * 1000 + typeRows.indexOf(type) * 10 + serial),
              facilityId: facility.id,
              unitTypeId: type.id,
              code: `${facility.code}-${type.code}-${String(serial).padStart(3, "0")}`,
              status: "AVAILABLE",
              floor: serial < 4 ? "1" : "2",
              locationDescription: `Dãy ${serial < 4 ? "A" : "B"} · ${type.sizeLabel} · Ô ${String(serial).padStart(2, "0")}`,
            })
            .onConflictDoNothing();
        }
      }

      for (let scenario = 0; scenario < 3; scenario++) {
        const ordinal = facilityIndex * 3 + scenario + 1;
        const type = typeRows[(facilityIndex + scenario) % typeRows.length];
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
          bookingCode: paid ? code : null,
          userId: scenario === 0 && facilityIndex % 3 === 0 ? null : customer.id,
          facilityId: facility.id,
          unitTypeId: type.id,
          checkInDate,
          checkInSlotId: slot.id,
          requestedMonths: months,
          rentalEndAt,
          monthlyRateSnapshot: String(type.monthlyPrice),
          rentalFeeAmount: String(type.monthlyPrice * months),
          depositAmount: String(type.monthlyPrice),
          totalAmount: String(type.monthlyPrice * (months + 1)),
          contactName: paid ? customer.name : null,
          contactEmail: paid ? customer.email : null,
          contactPhone: paid ? `+84${customer.phone.slice(1)}` : null,
          accessTokenHash: tokenHash,
          status: paid ? "CONFIRMED" : "DRAFT",
          assignedStaffId: scenario === 1 ? staff.id : null,
          qrTokenHash: paid ? hash(qr) : null,
        };
        await tx.insert(bookings).values(row).onConflictDoNothing();
        if (!paid) continue;
        await tx
          .insert(payments)
          .values({
            id: id("11000000", ordinal),
            bookingId,
            holdTokenHash: tokenHash,
            provider: "MOCK",
            providerPaymentId: `local-seed:${bookingId}`,
            idempotencyKey: `local-seed:${bookingId}`,
            paymentCode: `DEMO${String(ordinal).padStart(6, "0")}`,
            totalAmount: row.totalAmount,
            currency: "VND",
            status: "SUCCEEDED",
            paidAt: new Date(),
          })
          .onConflictDoNothing();
        await tx
          .insert(capacityAllocations)
          .values({
            id: id("a1000000", ordinal),
            facilityId: facility.id,
            unitTypeId: type.id,
            referenceId: bookingId,
            kind: "BOOKING",
            status: "ACTIVE",
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
              bookingId,
              physicalUnitId: unit.id,
              assignedBy: manager.id,
              status: "ACTIVE",
              reason: "Local demo: prepared booking",
            })
            .onConflictDoNothing();
        }
      }
    }

    // Keep the original Swagger IDs usable for check-in and snapshot-based capacity.
    const originals = await tx
      .select()
      .from(bookings)
      .where(inArray(bookings.id, Object.values(SEED_IDS.bookings)));
    for (const [index, booking] of originals.entries()) {
      const slot = slots.find((slot) => slot.id === booking.checkInSlotId);
      if (!slot) throw new Error("Missing original seed slot");
      const start = new Date(`${booking.checkInDate}T${slot.startTime}+07:00`);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + booking.requestedMonths);
      await tx
        .update(bookings)
        .set({
          rentalEndAt: end,
          contactPhone: booking.contactPhone?.replace(/^0/, "+84"),
          assignedStaffId: booking.status === "CONFIRMED" ? SEED_USERS[1].id : null,
          qrTokenHash: hash(createHmac("sha256", qrSecret).update(booking.id).digest("hex")),
        })
        .where(eq(bookings.id, booking.id));
      if (booking.status === "CONFIRMED") {
        await tx
          .insert(capacityAllocations)
          .values({
            id: id("a2000000", index + 1),
            facilityId: booking.facilityId,
            unitTypeId: booking.unitTypeId,
            referenceId: booking.id,
            kind: "BOOKING",
            status: "ACTIVE",
            startsAt: start,
            endsAt: end,
          })
          .onConflictDoNothing();
      } else if (booking.status === "NO_SHOW") {
        await tx
          .update(payments)
          .set({
            status: "REFUND_PENDING",
            refundReason: "NO_SHOW",
            refundAmount: booking.rentalFeeAmount,
            depositForfeitedAmount: booking.depositAmount,
          })
          .where(eq(payments.bookingId, booking.id));
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
        .insert(bookings)
        .values({
          id: bookingId,
          bookingCode: cancelled ? `DEMO-${scenario}` : null,
          userId: SEED_USERS[0].id,
          facilityId,
          unitTypeId: type.id,
          checkInDate,
          checkInSlotId: slot.id,
          requestedMonths: 2,
          rentalEndAt: end,
          monthlyRateSnapshot: String(type.monthlyPrice),
          rentalFeeAmount: String(type.monthlyPrice * 2),
          depositAmount: String(type.monthlyPrice),
          totalAmount: String(type.monthlyPrice * 3),
          status: cancelled ? "CANCELLED" : "DRAFT",
          accessTokenHash: tokenHash,
          contactName: SEED_USERS[0].name,
          contactEmail: SEED_USERS[0].email,
          contactPhone: `+84${SEED_USERS[0].phone.slice(1)}`,
        })
        .onConflictDoNothing();
      await tx
        .insert(payments)
        .values({
          id: id("12000000", index + 1),
          bookingId,
          holdTokenHash: tokenHash,
          provider: "MOCK",
          providerPaymentId: `local-seed:${bookingId}`,
          idempotencyKey: `local-seed:${bookingId}`,
          paymentCode: `DEMO-PAY-${index + 1}`,
          totalAmount: String(type.monthlyPrice * 3),
          currency: "VND",
          status: cancelled
            ? "REFUND_PENDING"
            : scenario === "FAILED_PAYMENT"
              ? "FAILED"
              : "PENDING",
          paidAt: cancelled ? new Date() : null,
          refundReason: cancelled ? "CUSTOMER_CANCELLATION" : null,
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
            kind: "HOLD",
            status: index === 0 ? "ACTIVE" : "EXPIRED",
            startsAt: start,
            endsAt: end,
            expiresAt: new Date(Date.now() + (index === 0 ? 600000 : -60000)),
          })
          .onConflictDoNothing();
      }
    }
    // There is no active Rental for this legacy fixture; do not seed phantom occupancy.
    await tx
      .update(storageUnits)
      .set({ status: "AVAILABLE" })
      .where(eq(storageUnits.id, SEED_IDS.storageUnits["HCM-01-006"]));
    for (const code of Object.keys(SEED_IDS.storageUnits)) {
      await tx
        .update(storageUnits)
        .set({ floor: "1", locationDescription: `Khu demo bàn giao · ${code}` })
        .where(eq(storageUnits.code, code));
    }
  });
  console.log(
    "Extended demo ready: 10 facilities, 8 types, 328 units, 29 users, 37 bookings, paid/pending/failed/refund/expired-hold scenarios.",
  );
}
