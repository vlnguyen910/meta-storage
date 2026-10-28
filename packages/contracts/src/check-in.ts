import { z } from "zod";
import { PhysicalUnitAssignmentSchema } from "./bookings";
import { PaymentStatus } from "./payments";

export const CheckInLookupTypeSchema = z.enum(["QR_TOKEN", "BOOKING_CODE"]);

export type CheckInLookupType = z.infer<typeof CheckInLookupTypeSchema>;

export const CheckInLookupInputSchema = z.object({
  type: CheckInLookupTypeSchema,
  value: z.string().trim().min(1).max(500),
});

export type CheckInLookupInput = z.infer<typeof CheckInLookupInputSchema>;

export const CheckInEligibilityReasonCodeSchema = z.enum([
  "TOO_EARLY",
  "DEADLINE_PASSED",
  "CHECKIN_SLOT_NOT_CONFIGURED",
  "INVALID_BOOKING_STATUS",
  "PAYMENT_NOT_SUCCEEDED",
  "UNIT_NOT_ASSIGNED",
]);

export type CheckInEligibilityReasonCode = z.infer<typeof CheckInEligibilityReasonCodeSchema>;

export const CheckInPaymentSummarySchema = z.object({
  status: z.nativeEnum(PaymentStatus).nullable(),
  paidAt: z.string().datetime().nullable(),
  totalAmount: z.number().nonnegative().nullable(),
  rentalFeeAmount: z.number().nonnegative().nullable(),
  depositAmount: z.number().nonnegative().nullable(),
  currency: z.string().length(3).nullable(),
});

export type CheckInPaymentSummary = z.infer<typeof CheckInPaymentSummarySchema>;

export const CheckInEligibilitySchema = z.object({
  canProceed: z.boolean(),
  reasons: z.array(CheckInEligibilityReasonCodeSchema),
});

export type CheckInEligibility = z.infer<typeof CheckInEligibilitySchema>;

export const CheckInBookingSummarySchema = z.object({
  id: z.string().uuid(),
  bookingCode: z.string(),
  status: z.enum(["CONFIRMED", "CANCELLED", "NO_SHOW", "CHECKED_IN"]),
  facilityId: z.string().uuid(),
  facilityName: z.string(),
  unitTypeName: z.string(),
  unitTypeSizeLabel: z.string(),
  contactName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  totalAmount: z.number().nonnegative(),
  requestedMonths: z.number().int(),
  checkInSlotStart: z.string().datetime(),
  checkInSlotEnd: z.string().datetime().nullable(),
  graceEndsAt: z.string().datetime().nullable(),
  rentalEndAt: z.string().datetime(),
});

export type CheckInBookingSummary = z.infer<typeof CheckInBookingSummarySchema>;

export const CheckInLookupResultSchema = z.object({
  booking: CheckInBookingSummarySchema,
  payment: CheckInPaymentSummarySchema,
  assignedUnit: PhysicalUnitAssignmentSchema.nullable(),
  eligibility: CheckInEligibilitySchema,
});

export type CheckInLookupResult = z.infer<typeof CheckInLookupResultSchema>;
