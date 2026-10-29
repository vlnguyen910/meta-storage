import {
  APPOINTMENT_STATUSES as AppointmentStatusEnum,
  APPOINTMENT_TYPES as AppointmentTypeEnum,
} from "@metastorage/database/schema/appointments";
import { z } from "zod";
import type { ReservationRecordDto } from "./reservations";

export { AppointmentStatusEnum as APPOINTMENT_STATUSES, AppointmentTypeEnum as APPOINTMENT_TYPES };

export const AppointmentIdSchema = z.object({ id: z.uuid() });
export const AppointmentQuerySchema = z.object({
  facilityId: z.uuid().optional(),
  appointmentType: z.enum(AppointmentTypeEnum).optional(),
  status: z.enum(AppointmentStatusEnum).optional(),
});
export const CreateAppointmentSchema = z
  .object({
    facilityId: z.uuid().optional(),
    appointmentType: z.enum(AppointmentTypeEnum),
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
  status: z.enum(AppointmentStatusEnum).optional(),
  assignedStaffId: z.uuid().optional(),
  physicalUnitId: z.uuid().optional(),
  assignmentReason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});
export type AppointmentQuery = z.infer<typeof AppointmentQuerySchema>;
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof UpdateAppointmentSchema>;

export type AppointmentRecordDto = Omit<
  import("@metastorage/database/schema/appointments").AppointmentRecord,
  "createdAt" | "updatedAt"
> & {
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
  createdAt: string;
  updatedAt: string;
};
