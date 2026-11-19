import type {
  AppointmentRecordDto,
  FacilitySupportTicket,
  FacilityTaskDetail,
} from "@metastorage/contracts";
import { expect, it } from "vitest";
import {
  appointmentItem,
  isCancelledOrNoShowDispatchItem,
  isCompletedDispatchItem,
  isInactiveDispatchItem,
  readiness,
  supportTicketDispatchItem,
} from "./use-dispatch";

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

it("correctly identifies cancelled and no-show dispatch items", () => {
  const cancelledCheckIn = appointmentItem({
    id: "app-cancelled",
    appointmentType: "CHECK_IN",
    status: "CANCELLED",
    customerId: "cust-1",
    facilityId: "fac-1",
    scheduledDate: "2026-11-19",
  } as unknown as AppointmentRecordDto);
  expect(cancelledCheckIn.status).toBe("CANCELLED");
  expect(isCancelledOrNoShowDispatchItem(cancelledCheckIn)).toBe(true);
  expect(isCompletedDispatchItem(cancelledCheckIn)).toBe(false);
  expect(isInactiveDispatchItem(cancelledCheckIn)).toBe(true);

  const noShowCheckIn = appointmentItem({
    id: "app-noshow",
    appointmentType: "CHECK_IN",
    status: "NO_SHOW",
    customerId: "cust-2",
    facilityId: "fac-1",
    scheduledDate: "2026-11-19",
  } as unknown as AppointmentRecordDto);
  expect(noShowCheckIn.status).toBe("NO_SHOW");
  expect(isCancelledOrNoShowDispatchItem(noShowCheckIn)).toBe(true);
  expect(isCompletedDispatchItem(noShowCheckIn)).toBe(false);
  expect(isInactiveDispatchItem(noShowCheckIn)).toBe(true);

  const cancelledSupport = supportTicketDispatchItem(
    {
      id: "ticket-canc",
      bookingId: null,
      reservationId: null,
      facilityId: "fac-1",
      rentalId: null,
      storageUnitId: null,
      paymentId: null,
      category: "GENERAL",
      subject: "Yêu cầu đã hủy",
      description: "Hủy yêu cầu",
      status: "CANCELLED",
      priority: "NORMAL",
      createdAt: "2026-11-19T08:00:00.000Z",
      actionDueAt: "2026-11-19T18:00:00.000Z",
      customer: { name: "User", email: "u@test.com", phone: null },
      unitCode: null,
      bookingCode: null,
    } as unknown as FacilitySupportTicket,
    null,
  );
  expect(isCancelledOrNoShowDispatchItem(cancelledSupport)).toBe(true);
  expect(isCompletedDispatchItem(cancelledSupport)).toBe(false);
  expect(isInactiveDispatchItem(cancelledSupport)).toBe(true);
});

it("maps support tickets to dispatch items and handles assignment status", () => {
  const ticket = {
    id: "4bcadc0a-372a-423f-8ce7-f8f1948cd9e8",
    bookingId: null,
    reservationId: "7863bf25-8246-43c1-9320-4d836913108e",
    facilityId: "fac-1",
    rentalId: "7f7a77db-4b46-4b97-9944-53c482a20913",
    storageUnitId: "72000000-0000-4000-8000-000000001022",
    paymentId: null,
    category: "STORAGE_UNIT",
    subject: "Cửa kho bị kẹt",
    description: "Không mở được khóa ô kho",
    status: "OPEN",
    priority: "NORMAL",
    version: 0,
    actionDueAt: "2026-11-19T18:00:00Z",
    createdAt: "2026-11-19T06:00:00Z",
    updatedAt: "2026-11-19T06:00:00Z",
    closedAt: null,
    closureKind: null,
    closeReason: null,
    customer: {
      name: "Lê Anh",
      email: "customer@example.com",
      phone: "0901234567",
    },
    unitCode: "HCM-01-UT-1M-002",
    bookingCode: "BK-7863-13108E",
  } as unknown as FacilitySupportTicket;

  // 1. Unassigned ticket -> NEEDS_STAFF
  const unassigned = supportTicketDispatchItem(ticket, null);
  expect(unassigned.id).toBe(ticket.id);
  expect(unassigned.appointmentType).toBe("SUPPORT");
  expect(unassigned.bookingCode).toBe("YC-4BCA-8CD9E8");
  expect(unassigned.contactName).toBe("Lê Anh");
  expect(unassigned.contactPhone).toBe("0901234567");
  expect(unassigned.assignedStaff).toBeNull();
  expect(unassigned.assignedUnit?.physicalUnitCode).toBe("HCM-01-UT-1M-002");
  expect(readiness(unassigned)).toBe("NEEDS_STAFF");
  expect(isCompletedDispatchItem(unassigned)).toBe(false);

  // 2. Assigned ticket -> CONFIRMED
  const assigned = supportTicketDispatchItem(ticket, {
    id: "task-1",
    facilityId: "fac-1",
    assignedStaffId: "staff-1",
    assignedStaffName: "Trần Quốc Huy",
    type: "HANDLE_SUPPORT",
    referenceType: "SUPPORT_TICKET",
    referenceId: ticket.id,
    status: "ASSIGNED",
  } as unknown as FacilityTaskDetail);
  expect(assigned.assignedStaff?.id).toBe("staff-1");
  expect(assigned.assignedStaff?.name).toBe("Trần Quốc Huy");
  expect(readiness(assigned)).toBe("CONFIRMED");
  expect(isCompletedDispatchItem(assigned)).toBe(false);

  // 3. Completed ticket -> COMPLETED
  const completed = supportTicketDispatchItem(ticket, {
    id: "task-1",
    facilityId: "fac-1",
    assignedStaffId: "staff-1",
    assignedStaffName: "Trần Quốc Huy",
    type: "HANDLE_SUPPORT",
    referenceType: "SUPPORT_TICKET",
    referenceId: ticket.id,
    status: "COMPLETED",
  } as unknown as FacilityTaskDetail);
  expect(readiness(completed)).toBe("COMPLETED");
  expect(isCompletedDispatchItem(completed)).toBe(true);
});
