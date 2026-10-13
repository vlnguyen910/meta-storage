import { z } from "zod";
import { BookingConfirmationSchema, PaidBookingSchema } from "./bookings";

export enum PaymentStatus {
  PENDING = "PENDING",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export const PaymentSchema = z.object({
  id: z.string(),
  reservationId: z.string(),
  amount: z.number().nonnegative(),
  status: z.nativeEnum(PaymentStatus),
  brand: z.string(),
  last4: z.string().length(4),
  paidAt: z.string(),
});

export type Payment = z.infer<typeof PaymentSchema>;

export const PaymentCheckoutInputSchema = z.object({
  holdToken: z.string().min(32),
  idempotencyKey: z.string().min(16).max(128),
  paymentMethodToken: z.string().min(1),
});

export type PaymentCheckoutInput = z.infer<typeof PaymentCheckoutInputSchema>;

export const PaymentDraftParamsSchema = z.object({
  draftId: z.string().uuid(),
});
export type PaymentDraftParams = z.infer<typeof PaymentDraftParamsSchema>;

export const PaymentIdParamsSchema = z.object({
  paymentId: z.string().uuid(),
});
export type PaymentIdParams = z.infer<typeof PaymentIdParamsSchema>;

export const PaymentResultSchema = z.object({
  id: z.string().uuid(),
  status: z.literal("SUCCEEDED"),
  provider: z.string(),
  providerPaymentId: z.string(),
  paidAt: z.string().datetime(),
  pricing: PaidBookingSchema.shape.pricing,
  booking: PaidBookingSchema,
  confirmation: z.lazy(() => BookingConfirmationSchema).optional(),
});

export type PaymentResult = z.infer<typeof PaymentResultSchema>;

export const SepayPaymentInstructionsSchema = z.object({
  paymentCode: z.string(),
  bankName: z.string(),
  accountNumber: z.string(),
  accountName: z.string(),
  amount: z.string(),
  currency: z.string().length(3),
  content: z.string(),
  expiresAt: z.string().datetime(),
});

export type SepayPaymentInstructions = z.infer<typeof SepayPaymentInstructionsSchema>;

export const PaymentPendingResponseSchema = z.object({
  paymentId: z.string().uuid(),
  status: z.literal("PENDING"),
  provider: z.literal("sepay"),
  paymentCode: z.string(),
  transferInstructions: SepayPaymentInstructionsSchema.optional(),
  checkoutUrl: z.string().url().optional(),
  checkoutFormFields: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  expiresAt: z.string().datetime(),
  confirmation: z.undefined().optional(),
});

export type PaymentPendingResponse = z.infer<typeof PaymentPendingResponseSchema>;

export type PaymentResponse = PaymentResult | PaymentPendingResponse;

export const PaymentStatusResponseSchema = z.object({
  paymentId: z.string().uuid(),
  status: z.enum(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"]),
  provider: z.string(),
  paymentCode: z.string(),
  transferInstructions: SepayPaymentInstructionsSchema.optional(),
  checkoutUrl: z.string().url().optional(),
  checkoutFormFields: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  confirmation: z.lazy(() => BookingConfirmationSchema).optional(),
});

export type PaymentStatusResponse = z.infer<typeof PaymentStatusResponseSchema>;
