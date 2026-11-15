import { z } from "zod";

const fields = {
  id: z.string().min(1),
  recipientId: z.string().min(1),
  occurredAt: z.iso.datetime(),
};

export const WorkUpdateNotificationSchema = z.discriminatedUnion("type", [
  z.object({
    ...fields,
    type: z.literal("STAFF_WORK_UPDATED"),
    facilityId: z.string().min(1),
    appointmentId: z.string().min(1).optional(),
    taskId: z.string().min(1).optional(),
  }),
  z.object({
    ...fields,
    type: z.literal("CUSTOMER_APPOINTMENT_UPDATED"),
    appointmentId: z.string().min(1),
  }),
]);
