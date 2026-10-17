import { CheckInLookupInputSchema } from "@metastorage/contracts";
import { z } from "zod";

export const CheckInLookupBodySchema = CheckInLookupInputSchema;

export const CheckInBookingParamsSchema = z.object({
  bookingId: z.string().uuid(),
});
