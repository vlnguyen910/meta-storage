import {
  AppointmentStatus,
  AppointmentType,
  ReservationStatus,
} from "@metastorage/database/schema-domain";
import { z } from "zod";
import { APPOINTMENT_RESERVATION_MESSAGES as m } from "./appointment-reservation.messages";

const id = z.string().uuid();
const dateTime = z.string().datetime({ offset: true });
const pagination = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
};
export const ResourceIdSchema = z.object({ id });
export const CreateReservationSchema = z
  .object({
    facilityId: id,
    unitTypeId: id,
    startAt: dateTime,
    requestedMonths: z.number().int().min(1).max(12),
  })
  .strict();
export const UpdateReservationSchema = z
  .object({
    startAt: dateTime,
    requestedMonths: z.number().int().min(1).max(12),
  })
  .strict();
export const ReservationQuerySchema = z.object({
  ...pagination,
  facilityId: id.optional(),
  status: z.enum(ReservationStatus).optional(),
});
const appointmentStatus = z.enum(AppointmentStatus);
const appointmentType = z.enum(AppointmentType);
export const CreateAppointmentSchema = z
  .object({
    appointmentType,
    scheduledDate: z.iso.date(),
    slotId: id,
    contactPhone: z
      .string()
      .regex(/^\d{10}$/)
      .nullable()
      .optional(),
    notes: z.string().max(5000).nullable().optional(),
    reservationId: id.optional(),
    rentalId: id.optional(),
    supportTicketId: id.optional(),
    facilityId: id.optional(),
    customerId: id.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const valid =
      value.appointmentType === AppointmentType.CHECK_IN
        ? !!value.reservationId && !value.rentalId && !value.supportTicketId
        : value.appointmentType === AppointmentType.CHECK_OUT
          ? !!value.rentalId && !value.reservationId && !value.supportTicketId
          : !value.reservationId &&
            !value.rentalId &&
            (!!value.supportTicketId || !!value.facilityId);
    if (!valid) ctx.addIssue({ code: "custom", message: m.invalidContext });
  });
export const UpdateAppointmentSchema = z
  .object({
    scheduledDate: z.iso.date().optional(),
    slotId: id.optional(),
    contactPhone: z
      .string()
      .regex(/^\d{10}$/)
      .nullable()
      .optional(),
    notes: z.string().max(5000).nullable().optional(),
    assignedStaffId: id.nullable().optional(),
    status: appointmentStatus.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, m.emptyUpdate);
export const AppointmentQuerySchema = z.object({
  ...pagination,
  facilityId: id.optional(),
  date: z.iso.date().optional(),
  type: appointmentType.optional(),
  status: appointmentStatus.optional(),
});
export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;
export type UpdateReservationInput = z.infer<typeof UpdateReservationSchema>;
export type ReservationQuery = z.infer<typeof ReservationQuerySchema>;
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof UpdateAppointmentSchema>;
export type AppointmentQuery = z.infer<typeof AppointmentQuerySchema>;
