import { z } from "zod";
import { FacilitySchema } from "./facilities";
import { PaymentSchema } from "./payments";
import { ReservationDraftContactSchema } from "./reservation-contact";

export enum ReservationStatus {
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
  CHECKED_IN = "CHECKED_IN",
}

export const ReservationQuoteSchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  unitTypeId: z.string(),
  unitType: z.string(),
  sizeLabel: z.string(),
  startDate: z.string(),
  durationMonths: z.number().int().min(1).max(12),
  monthlyPrice: z.number().nonnegative(),
  rentalTotal: z.number().nonnegative(),
  depositAmount: z.number().nonnegative(),
  totalEstimated: z.number().nonnegative(),
  expiresAt: z.string(),
});

export type ReservationQuote = z.infer<typeof ReservationQuoteSchema>;

export const ReservationSchema = z.object({
  id: z.string(),
  code: z.string(),
  userId: z.string().nullable(),
  facility: FacilitySchema,
  unitTypeId: z.string(),
  unitType: z.string(),
  sizeLabel: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  durationMonths: z.number().int(),
  status: z.nativeEnum(ReservationStatus),
  monthlyPrice: z.number(),
  depositAmount: z.number(),
  totalEstimated: z.number(),
  payment: PaymentSchema,
  createdAt: z.string(),
});

export type Reservation = z.infer<typeof ReservationSchema>;

export const ReservationDraftInputSchema = z.object({
  facilityId: z.string().uuid(),
  unitTypeId: z.string().uuid(),
  checkInAt: z.string().datetime({ offset: true }),
  durationMonths: z.number().int().min(1).max(12),
  contact: ReservationDraftContactSchema,
});

export type ReservationDraftInput = z.infer<typeof ReservationDraftInputSchema>;

export const ReservationPricingSchema = z.object({
  monthlyRateSnapshot: z.string(),
  rentalFeeAmount: z.string(),
  depositAmount: z.string(),
  totalAmount: z.string(),
  currency: z.string().length(3),
});

export type ReservationPricing = z.infer<typeof ReservationPricingSchema>;

export const ReservationDraftSchema = z.object({
  id: z.string().uuid(),
  facilityId: z.string().uuid(),
  unitTypeId: z.string().uuid(),
  checkInAt: z.string().datetime(),
  rentalEndAt: z.string().datetime(),
  durationMonths: z.number().int().min(1).max(12),
  contact: ReservationDraftContactSchema,
  draftAccessToken: z.string().min(32),
  status: z.literal("DRAFT"),
  pricingStatus: z.enum(["PRICING_NOT_CONFIGURED", "PRICED"]),
  pricing: ReservationPricingSchema.nullable(),
});

export type ReservationDraft = z.infer<typeof ReservationDraftSchema>;

export const ReservationHoldSchema = z.object({
  holdId: z.string().uuid(),
  holdToken: z.string().min(32),
  unitTypeId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  status: z.literal("ACTIVE"),
});

export type ReservationHold = z.infer<typeof ReservationHoldSchema>;

export type { ConfirmReservationInput, ReservationQuoteInput } from "./reservations.types";
