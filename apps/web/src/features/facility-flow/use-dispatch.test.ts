import type { AppointmentRecordDto } from "@metastorage/contracts";
import { expect, it } from "vitest";
import { appointmentItem, isCompletedDispatchItem, readiness } from "./use-dispatch";

it("keeps appointment IDs for actions and reservation IDs for the incumbent display", () => {
  const a = {
    id: "appointment",
    reservationId: "reservation",
    customerId: "customer",
    customerName: "Nguyễn An",
    facilityId: "facility",
    appointmentType: "CHECK_IN",
    status: "SCHEDULED",
    scheduledDate: "2030-06-01",
    slotStart: "09:00:00",
    slotEnd: "10:00:00",
    createdAt: "2026-10-29T00:00:00Z",
    paymentStatus: "PENDING",
    reservation: { status: "DRAFT", totalAmount: 2000000, requestedMonths: 1 },
    assignedUnit: null,
  } as unknown as AppointmentRecordDto;
  const pending = appointmentItem(a);
  expect(pending.id).toBe("appointment");
  expect(pending.bookingCode).toBe("reservation");
  expect(pending.paidAt).toBeNull();
  expect(readiness(pending)).toBe("PAYMENT_PENDING");
  const paid = appointmentItem({
    ...a,
    paymentStatus: "SUCCEEDED",
    reservation: { ...a.reservation, status: "CONFIRMED" } as NonNullable<
      AppointmentRecordDto["reservation"]
    >,
  });
  expect(readiness(paid)).toBe("NEEDS_UNIT");
  expect(
    readiness({
      ...paid,
      assignedUnit: {
        physicalUnitId: "unit",
        physicalUnitCode: "A-01",
        status: "ACTIVE",
      } as NonNullable<AppointmentRecordDto["assignedUnit"]>,
    }),
  ).toBe("NEEDS_STAFF");
});

it.each([
  { id: null, physicalUnitId: null, physicalUnitCode: null, status: null },
  { id: "assignment", physicalUnitId: "unit", physicalUnitCode: null, status: "ACTIVE" },
  { id: "assignment", physicalUnitId: "unit", physicalUnitCode: "A-01", status: "REASSIGNED" },
])("does not treat an empty or ended assignment as a prepared unit", (assignedUnit) => {
  const item = appointmentItem({
    id: "appointment",
    status: "CONFIRMED",
    appointmentType: "CHECK_IN",
    paymentStatus: "SUCCEEDED",
    assignedUnit,
  } as unknown as AppointmentRecordDto);
  expect(item.assignedUnit).toBeNull();
  expect(readiness(item)).toBe("NEEDS_UNIT");
});

it("shows distinct compact references for seeded reservations and preserves full action identifiers", () => {
  const data = {
    id: "71000000-0000-4000-8000-000000000001",
    reservationId: "81000000-0000-4000-8000-000000000005",
    customerId: "61000000-0000-4000-8000-000000000005",
    customerName: "Trần Ngọc Anh",
    facilityId: "facility",
    appointmentType: "CHECK_IN",
    scheduledDate: "2030-06-01",
  } as AppointmentRecordDto;
  const first = appointmentItem(data);
  const second = appointmentItem({
    ...data,
    reservationId: "81000000-0000-4000-8000-000000000006",
  });
  expect(first.id).toBe(data.id);
  expect(first.reservationId).toBe(data.reservationId);
  expect(first.bookingCode).toBe("BK-8100-000005");
  expect(second.bookingCode).toBe("BK-8100-000006");
  expect(first.contactName).toBe("Trần Ngọc Anh");
});

it("correctly identifies completed dispatch items across check-in, check-out, and support", () => {
  const completedCheckIn = appointmentItem({
    id: "app-check-in",
    appointmentType: "CHECK_IN",
    status: "COMPLETED",
    customerId: "cust-1",
    facilityId: "fac-1",
    scheduledDate: "2026-11-19",
  } as unknown as AppointmentRecordDto);
  expect(completedCheckIn.status).toBe("CHECKED_IN");
  expect(isCompletedDispatchItem(completedCheckIn)).toBe(true);

  const completedReturn = appointmentItem({
    id: "app-return",
    appointmentType: "CHECK_OUT",
    status: "COMPLETED",
    customerId: "cust-2",
    rentalId: "rental-1",
    facilityId: "fac-1",
    scheduledDate: "2026-11-19",
  } as unknown as AppointmentRecordDto);
  expect(isCompletedDispatchItem(completedReturn)).toBe(true);

  const completedSupport = appointmentItem({
    id: "app-support",
    appointmentType: "SUPPORT",
    status: "COMPLETED",
    customerId: "cust-3",
    facilityId: "fac-1",
    scheduledDate: "2026-11-19",
  } as unknown as AppointmentRecordDto);
  expect(isCompletedDispatchItem(completedSupport)).toBe(true);

  const activeCheckIn = appointmentItem({
    id: "app-active-ci",
    appointmentType: "CHECK_IN",
    status: "CONFIRMED",
    paymentStatus: "PENDING",
    customerId: "cust-4",
    facilityId: "fac-1",
    scheduledDate: "2026-11-19",
  } as unknown as AppointmentRecordDto);
  expect(isCompletedDispatchItem(activeCheckIn)).toBe(false);

  const activeReturn = appointmentItem({
    id: "app-active-ret",
    appointmentType: "CHECK_OUT",
    status: "CONFIRMED",
    customerId: "cust-5",
    rentalId: "rental-2",
    facilityId: "fac-1",
    scheduledDate: "2026-11-19",
  } as unknown as AppointmentRecordDto);
  expect(isCompletedDispatchItem(activeReturn)).toBe(false);

  const activeSupport = appointmentItem({
    id: "app-active-sup",
    appointmentType: "SUPPORT",
    status: "SCHEDULED",
    customerId: "cust-6",
    facilityId: "fac-1",
    scheduledDate: "2026-11-19",
  } as unknown as AppointmentRecordDto);
  expect(isCompletedDispatchItem(activeSupport)).toBe(false);
});
