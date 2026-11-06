import { beforeEach, expect, mock, test } from "bun:test";
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from "@metastorage/contracts";
import { appointment, id } from "../e2e/customer-home.data";

const list = mock(async () => [appointment]);
const create = mock(async () => appointment);
const update = mock(async () => appointment);
let status = "DRAFT",
  paymentStatus: string | null = null;
mock.module("../src/lib/api", () => ({
  api: {
    appointments: { mine: list, create, update },
    reservations: { get: async () => ({ status, paymentStatus }) },
  },
}));
mock.module("../src/features/customer-api/customer-native", () => ({
  clearCustomerCommand: async () => undefined,
  readCustomerCommand: async () => null,
  saveCustomerCommand: async () => undefined,
}));
const { bookingAppointment, retireBookingAppointment } = await import(
  "../src/features/booking/booking.service"
);
const command = {
  facilityId: id(20),
  unitTypeId: id(30),
  draftId: id(60),
  checkInDate: "2026-11-07",
  checkInSlotId: id(50),
  durationMonths: 1,
  contactPhone: "0903000111",
  key: "a-stable-idempotency-key",
};
beforeEach(() => {
  list.mockClear();
  create.mockClear();
  update.mockClear();
  list.mockImplementation(async () => [appointment]);
  status = "DRAFT";
  paymentStatus = null;
});

test("retries find the existing appointment instead of creating a duplicate after an uncertain response", async () => {
  expect(await bookingAppointment(command.draftId, { ...command, notes: "Hỗ trợ xe đẩy" })).toEqual(
    appointment,
  );
  expect(create).not.toHaveBeenCalled();
});

test("a new appointment uses the reservation context and selected contact data", async () => {
  list.mockImplementation(async () => []);
  await bookingAppointment(command.draftId, { ...command, notes: " Hỗ trợ xe đẩy " });
  expect(create).toHaveBeenCalledWith({
    appointmentType: APPOINTMENT_TYPES.CHECK_IN,
    reservationId: command.draftId,
    scheduledDate: command.checkInDate,
    slotId: command.checkInSlotId,
    contactPhone: command.contactPhone,
    notes: "Hỗ trợ xe đẩy",
  });
});

test("replacing an unpaid selection closes its appointment without a payment cancellation", async () => {
  await retireBookingAppointment(command);
  expect(update).toHaveBeenCalledWith(appointment.id, { status: APPOINTMENT_STATUSES.CANCELLED });
});

test("replacement never closes a paid or in-flight appointment", async () => {
  for (const current of ["PENDING", "SUCCEEDED", "REFUND_PENDING", "REFUNDED"]) {
    paymentStatus = current;
    await expect(retireBookingAppointment(command)).rejects.toThrow();
  }
  status = "CONFIRMED";
  paymentStatus = null;
  await expect(retireBookingAppointment(command)).rejects.toThrow();
  expect(update).not.toHaveBeenCalled();
});

test("retrying retirement after a lost response leaves an already closed appointment alone", async () => {
  list.mockImplementation(async () => [{ ...appointment, status: APPOINTMENT_STATUSES.CANCELLED }]);
  await retireBookingAppointment(command);
  expect(update).not.toHaveBeenCalled();
});
