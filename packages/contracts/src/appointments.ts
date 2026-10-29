import {
  APPOINTMENT_STATUSES as AppointmentStatusEnum,
  APPOINTMENT_TYPES as AppointmentTypeEnum,
} from "@metastorage/database/schema/appointments";
import { z } from "zod";

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
  notes: z.string().max(2000).optional(),
});
export type AppointmentQuery = z.infer<typeof AppointmentQuerySchema>;
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof UpdateAppointmentSchema>;
