import type { AppointmentRecordDto } from "@metastorage/contracts";
import { expect, it } from "vitest";
import { appointmentItem, readiness } from "./use-dispatch";

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
      assignedUnit: { physicalUnitId: "unit", physicalUnitCode: "A-01" } as NonNullable<
        AppointmentRecordDto["assignedUnit"]
      >,
    }),
  ).toBe("NEEDS_STAFF");
});
