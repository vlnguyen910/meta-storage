import {
  FacilityTaskReferenceType,
  FacilityTaskStatus,
} from "@metastorage/contracts/facility-tasks";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "./client";
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES, appointments } from "./schema/appointments";
import { bookings } from "./schema/bookings";
import { capacityAllocations } from "./schema/capacity-allocations";
import { checkInSlots } from "./schema/check-in-slots";
import { facilityTasks } from "./schema/facility-tasks";
import { InspectionType, inspections } from "./schema/inspections";
import { notificationOutbox } from "./schema/notification-outbox";
import { payments } from "./schema/payments";
import { RentalStatus, rentals } from "./schema/rentals";
import { ReservationStatus, reservations } from "./schema/reservations";
import { storageUnits } from "./schema/storage-units";
import { supportTickets } from "./schema/support";
import { unitAssignments } from "./schema/unit-assignments";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function amount(value: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 2147483647)
    throw new Error(
      "Booking migration requires nonnegative integer VND amounts within INTEGER range",
    );
  return parsed;
}

/** Run after schema migrations commit: PostgreSQL must commit new enum values first. */
export async function migrateBookingsToReservations(tx: Transaction) {
  await tx.execute(sql`select pg_advisory_xact_lock(420218, 2)`);
  await tx.execute(sql`lock table ${bookings} in share row exclusive mode`);
  const rows = await tx
    .select({
      booking: bookings,
      startsAt:
        sql<Date>`(${bookings.checkInDate} + ${checkInSlots.startTime}) at time zone 'Asia/Ho_Chi_Minh'`.mapWith(
          (value) => new Date(value),
        ),
    })
    .from(bookings)
    .innerJoin(checkInSlots, eq(checkInSlots.id, bookings.checkInSlotId))
    .orderBy(bookings.id)
    .for("update", { of: bookings });
  const [count] = await tx.select({ total: sql<number>`count(*)::integer` }).from(bookings);
  if (count?.total !== rows.length)
    throw new Error("Booking migration found a missing check-in slot");
  let converted = 0;
  for (const { booking, startsAt } of rows) {
    if (!Object.values(ReservationStatus).includes(booking.status as ReservationStatus))
      throw new Error("Booking migration found an unsupported lifecycle state");
    const activeTasks = await tx
      .select()
      .from(facilityTasks)
      .where(
        and(
          eq(facilityTasks.referenceType, FacilityTaskReferenceType.BOOKING),
          eq(facilityTasks.referenceId, booking.id),
          inArray(facilityTasks.status, [
            FacilityTaskStatus.ASSIGNED,
            FacilityTaskStatus.IN_PROGRESS,
          ]),
        ),
      )
      .for("update");
    if (
      booking.status === "CONFIRMED" &&
      (activeTasks.length > 1 ||
        activeTasks.some(
          (task) =>
            task.assignedStaffId !== booking.assignedStaffId ||
            task.facilityId !== booking.facilityId,
        ))
    )
      throw new Error(
        `Booking ${booking.id} has conflicting active task assignments; resolve them before migration`,
      );
    const values = {
      id: booking.id,
      customerId: booking.userId,
      facilityId: booking.facilityId,
      unitTypeId: booking.unitTypeId,
      requestedMonths: booking.requestedMonths,
      rentalStartAt: startsAt,
      rentalEndAt: booking.rentalEndAt,
      monthlyRateSnapshot: amount(booking.monthlyRateSnapshot),
      rentalFeeAmount: amount(booking.rentalFeeAmount),
      depositAmount: amount(booking.depositAmount),
      totalAmount: amount(booking.totalAmount),
      status: booking.status as ReservationStatus,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    };
    const [existing] = await tx
      .select()
      .from(reservations)
      .where(eq(reservations.id, booking.id))
      .for("update");
    if (
      existing &&
      (existing.customerId !== values.customerId ||
        existing.facilityId !== values.facilityId ||
        existing.unitTypeId !== values.unitTypeId ||
        existing.totalAmount !== values.totalAmount ||
        existing.depositAmount !== values.depositAmount ||
        existing.rentalFeeAmount !== values.rentalFeeAmount ||
        existing.requestedMonths !== values.requestedMonths ||
        existing.monthlyRateSnapshot !== values.monthlyRateSnapshot ||
        existing.rentalStartAt.getTime() !== values.rentalStartAt.getTime() ||
        existing.rentalEndAt.getTime() !== values.rentalEndAt.getTime())
    )
      throw new Error("Booking migration found conflicting reservation history");
    if (!existing) {
      await tx.insert(reservations).values(values);
      converted++;
    }
    if (booking.status !== "DRAFT" && booking.status !== "EXPIRED") {
      const status =
        booking.status === "CHECKED_IN"
          ? APPOINTMENT_STATUSES.COMPLETED
          : booking.status === "CANCELLED"
            ? APPOINTMENT_STATUSES.CANCELLED
            : booking.status === "NO_SHOW"
              ? APPOINTMENT_STATUSES.NO_SHOW
              : booking.assignedStaffId
                ? APPOINTMENT_STATUSES.CONFIRMED
                : APPOINTMENT_STATUSES.SCHEDULED;
      await tx
        .insert(appointments)
        .values({
          id: booking.id,
          reservationId: booking.id,
          facilityId: booking.facilityId,
          customerId: booking.userId,
          createdBy: booking.userId,
          appointmentType: APPOINTMENT_TYPES.CHECK_IN,
          scheduledDate: booking.checkInDate,
          slotId: booking.checkInSlotId,
          status,
          assignedStaffId: booking.assignedStaffId,
          contactPhone: booking.contactPhone,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
        })
        .onConflictDoNothing({ target: appointments.id });
      await tx
        .update(facilityTasks)
        .set({ referenceType: FacilityTaskReferenceType.APPOINTMENT })
        .where(
          and(
            eq(facilityTasks.referenceType, FacilityTaskReferenceType.BOOKING),
            eq(facilityTasks.referenceId, booking.id),
          ),
        );
      // Preserve a manager's selected unit as the staff's pending inspection.
      if (booking.status === "CONFIRMED" && booking.assignedStaffId) {
        const [assignment] = await tx
          .select()
          .from(unitAssignments)
          .where(
            and(eq(unitAssignments.bookingId, booking.id), eq(unitAssignments.status, "ACTIVE")),
          )
          .orderBy(unitAssignments.assignedAt, unitAssignments.id)
          .limit(1);
        const [task] = await tx
          .select()
          .from(facilityTasks)
          .where(
            and(
              eq(facilityTasks.referenceType, FacilityTaskReferenceType.APPOINTMENT),
              eq(facilityTasks.referenceId, booking.id),
              inArray(facilityTasks.status, [
                FacilityTaskStatus.ASSIGNED,
                FacilityTaskStatus.IN_PROGRESS,
              ]),
            ),
          )
          .limit(1);
        if (assignment && task) {
          const [inspection] = await tx
            .select({ id: inspections.id })
            .from(inspections)
            .where(eq(inspections.taskId, task.id))
            .limit(1);
          if (!inspection)
            await tx.insert(inspections).values({
              reservationId: booking.id,
              taskId: task.id,
              storageUnitId: assignment.physicalUnitId,
              inspectedBy: booking.assignedStaffId,
              inspectionType: InspectionType.CHECK_IN,
            });
        }
      }
    }
    if (["DRAFT", "EXPIRED", "CANCELLED", "NO_SHOW", "CHECKED_IN"].includes(booking.status)) {
      await tx
        .update(facilityTasks)
        .set({ status: FacilityTaskStatus.CANCELLED, updatedAt: new Date() })
        .where(
          and(
            inArray(facilityTasks.referenceType, [
              FacilityTaskReferenceType.BOOKING,
              FacilityTaskReferenceType.APPOINTMENT,
            ]),
            eq(facilityTasks.referenceId, booking.id),
            inArray(facilityTasks.status, [
              FacilityTaskStatus.ASSIGNED,
              FacilityTaskStatus.IN_PROGRESS,
            ]),
          ),
        );
    }
    await tx
      .update(inspections)
      .set({ reservationId: booking.id, bookingId: null })
      .where(eq(inspections.bookingId, booking.id));
    await tx
      .update(payments)
      .set({ reservationId: booking.id, bookingId: null })
      .where(eq(payments.bookingId, booking.id));
    await tx
      .update(rentals)
      .set({ reservationId: booking.id, bookingId: null })
      .where(eq(rentals.bookingId, booking.id));
    await tx
      .update(supportTickets)
      .set({ reservationId: booking.id, bookingId: null })
      .where(eq(supportTickets.bookingId, booking.id));
    await tx
      .update(notificationOutbox)
      .set({ reservationId: booking.id, bookingId: null })
      .where(eq(notificationOutbox.bookingId, booking.id));
    await tx
      .update(capacityAllocations)
      .set({ kind: "RESERVATION" })
      .where(
        and(
          eq(capacityAllocations.referenceId, booking.id),
          eq(capacityAllocations.kind, "BOOKING"),
        ),
      );
    const movedAssignments = await tx
      .update(unitAssignments)
      .set({ reservationId: booking.id, bookingId: null })
      .where(eq(unitAssignments.bookingId, booking.id))
      .returning();
    if (booking.status !== "CONFIRMED")
      for (const assignment of movedAssignments.filter((a) => a.status === "ACTIVE")) {
        await tx
          .update(unitAssignments)
          .set({
            status: booking.status === "CHECKED_IN" ? "COMPLETED" : "CANCELLED",
            endedAt: new Date(),
          })
          .where(eq(unitAssignments.id, assignment.id));
        const [activeRental] = await tx
          .select({ id: rentals.id })
          .from(rentals)
          .where(
            and(
              eq(rentals.storageUnitId, assignment.physicalUnitId),
              eq(rentals.status, RentalStatus.ACTIVE),
            ),
          )
          .limit(1);
        if (!activeRental)
          await tx
            .update(storageUnits)
            .set({ status: "AVAILABLE", updatedAt: new Date() })
            .where(
              and(
                eq(storageUnits.id, assignment.physicalUnitId),
                eq(storageUnits.status, "RESERVED"),
              ),
            );
      }
  }
  return { converted };
}
