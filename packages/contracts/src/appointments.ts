import { z } from "zod";
import type { ReservationRecordDto } from "./reservations";

export enum APPOINTMENT_TYPES {
  CHECK_IN = "CHECK_IN",
  CHECK_OUT = "CHECK_OUT",
  SUPPORT = "SUPPORT",
}

export enum APPOINTMENT_STATUSES {
  SCHEDULED = "SCHEDULED",
  CONFIRMED = "CONFIRMED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
}

export const AppointmentIdSchema = z.object({ id: z.uuid() });
export const AppointmentQuerySchema = z.object({
  facilityId: z.uuid().optional(),
  appointmentType: z.enum(APPOINTMENT_TYPES).optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
});
export const CreateAppointmentSchema = z
  .object({
    facilityId: z.uuid().optional(),
    appointmentType: z.enum(APPOINTMENT_TYPES),
    scheduledDate: z.iso.date(),
    slotId: z.uuid(),
    contactPhone: z.string().max(20).optional(),
    notes: z.string().max(2000).optional(),
    reservationId: z.uuid().optional(),
    rentalId: z.uuid().optional(),
    supportTicketId: z.uuid().optional(),
  })
  .superRefine((input, context) => {
    const validContext =
      (input.appointmentType === "CHECK_IN" &&
        !!input.reservationId &&
        !input.rentalId &&
        !input.supportTicketId) ||
      (input.appointmentType === "CHECK_OUT" &&
        !!input.rentalId &&
        !input.reservationId &&
        !input.supportTicketId) ||
      (input.appointmentType === "SUPPORT" &&
        !!input.supportTicketId &&
        !input.reservationId &&
        !input.rentalId);
    if (!validContext)
      context.addIssue({
        code: "custom",
        path: ["appointmentType"],
        message: "Appointment must reference one matching reservation, rental, or support ticket.",
      });
  });
export const UpdateAppointmentSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  assignedStaffId: z.uuid().optional(),
  physicalUnitId: z.uuid().optional(),
  assignmentReason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});
export type AppointmentQuery = z.infer<typeof AppointmentQuerySchema>;
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof UpdateAppointmentSchema>;

export type AppointmentRecordDto = {
  id: string;
  facilityId: string;
  appointmentType: APPOINTMENT_TYPES;
  scheduledDate: string;
  slotId: string;
  status: APPOINTMENT_STATUSES;
  customerId: string;
  contactPhone: string | null;
  reservationId: string | null;
  rentalId: string | null;
  supportTicketId: string | null;
  assignedStaffId: string | null;
  createdBy: string;
  notes: string | null;
  physicalUnitId?: string | null;
  assignmentReason?: string | null;
  createdAt: string;
  updatedAt: string;
  customerName?: string | null;
  customerEmail?: string | null;
  assignedStaffName?: string | null;
  assignedUnit?: {
    id: string;
    physicalUnitId: string;
    physicalUnitCode: string;
    assignedBy: string;
    assignedAt: string;
    endedAt: string | null;
    reason: string | null;
    status: string;
  } | null;
  slotName?: string;
  slotStart?: string;
  slotEnd?: string;
  reservation?: ReservationRecordDto | null;
  facility?: { id: string; name: string; address: string };
  unitType?: { id: string; name: string; sizeLabel: string } | null;
  handoverStage?: "WAITING_CUSTOMER" | "INSPECTING" | "READY_HANDOVER" | "HANDED_OVER";
  paidAt?: string | null;
  paymentStatus?: string | null;
};
