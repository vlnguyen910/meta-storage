import { z } from "zod";
import { BookingDraftInputSchema } from "./bookings";

export const CustomerAvailabilityQuerySchema = BookingDraftInputSchema.omit({
  facilityId: true,
}).extend({ durationMonths: z.coerce.number().int().min(1).max(12) });
export type CustomerAvailabilityQuery = z.infer<typeof CustomerAvailabilityQuerySchema>;
export type { CustomerAvailability } from "./customer-availability.types";
