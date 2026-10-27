import { z } from "zod";
import { bookingLookupMessages as m } from "./booking-lookup.messages";

export const BookingLookupFormSchema = z.object({
  bookingCode: z.string().trim().min(1, m.bookingCodeRequired).max(50, m.bookingCodeRequired),
  email: z.string().trim().email(m.emailInvalid).max(320, m.emailInvalid),
});

export type BookingLookupFormValues = {
  bookingCode: string;
  email: string;
};

export interface GuestAccessAttempt {
  identity: string;
  idempotencyKey: string;
}
