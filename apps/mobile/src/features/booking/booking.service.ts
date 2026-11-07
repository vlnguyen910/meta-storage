import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from "@metastorage/contracts";
import type { BookingValues, SavedBooking } from "../../common/booking.types";
import { savedBookingSchema } from "../../common/booking.utils";
import { api } from "../../lib/api";
import {
  clearCustomerCommand,
  readCustomerCommand,
  saveCustomerCommand,
} from "../customer-api/customer-native";
import { BOOKING as M } from "./booking.messages";

const operation = "mobile-booking";
export const saveBooking = (owner: string, command: SavedBooking) =>
  saveCustomerCommand(owner, operation, command);
export const clearBooking = (owner: string) => clearCustomerCommand(owner, operation);
export async function readBooking(owner: string) {
  const raw = await readCustomerCommand(owner, operation);
  if (!raw) return null;
  const result = savedBookingSchema.safeParse(raw);
  if (!result.success) throw new Error(M.error);
  return result.data;
}
export async function resumeBooking(owner: string) {
  const saved = await readBooking(owner);
  if (!saved) return null;
  const draft = await api.reservations.get(saved.draftId);
  if (!saved.paymentRequested && ["CANCELLED", "EXPIRED"].includes(draft.status)) {
    await clearBooking(owner);
    return null;
  }
  return {
    saved,
    draft,
    facility: draft.facility ?? { id: draft.facilityId, name: "MetaStorage", address: "" },
  };
}
export function bookingSignature(v: BookingValues) {
  return JSON.stringify([
    v.facilityId,
    v.unitTypeId,
    v.checkInDate,
    v.checkInSlotId,
    v.durationMonths,
    v.contactPhone.trim(),
    v.notes.trim(),
  ]);
}
export async function bookingAppointment(reservationId: string, values?: BookingValues) {
  const items = await api.appointments.mine({ appointmentType: APPOINTMENT_TYPES.CHECK_IN });
  const existing = items.find((item) => item.reservationId === reservationId);
  if (existing || !values) return existing;
  return api.appointments.create({
    appointmentType: APPOINTMENT_TYPES.CHECK_IN,
    reservationId,
    scheduledDate: values.checkInDate,
    slotId: values.checkInSlotId,
    contactPhone: values.contactPhone.trim(),
    notes: values.notes.trim() || undefined,
  });
}

// Replacing an unpaid selection retires only its appointment, without invoking refund/cancel-payment workflows.
export async function retireBookingAppointment(command: SavedBooking) {
  const reservation = await api.reservations.get(command.draftId);
  if (
    !["DRAFT", "EXPIRED", "CANCELLED"].includes(reservation.status) ||
    (reservation.paymentStatus && reservation.paymentStatus !== "FAILED")
  )
    throw new Error(M.conflict);
  const appointment = await bookingAppointment(command.draftId);
  if (
    appointment &&
    [APPOINTMENT_STATUSES.SCHEDULED, APPOINTMENT_STATUSES.CONFIRMED].includes(appointment.status)
  ) {
    await api.appointments.update(appointment.id, { status: APPOINTMENT_STATUSES.CANCELLED });
  }
}
