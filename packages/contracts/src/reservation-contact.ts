import { z } from "zod";

export const ReservationDraftContactSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().email().max(320),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
});

export type ReservationDraftContact = z.infer<typeof ReservationDraftContactSchema>;
