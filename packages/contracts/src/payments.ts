import { z } from "zod";
import { BookingConfirmationSchema, PaidBookingSchema } from "./bookings";

export type {
  BookingPaymentSession,
  ManualRefund,
  ManualRefundConfirmation,
  PaymentStatusResponse,
} from "./payments.types";

import { PAYMENT_CONTRACT_MESSAGES } from "./payments.messages";

export const BookingPaymentParamsSchema = z.object({
  bookingId: z.string().uuid(),
});
export type BookingPaymentParams = z.infer<typeof BookingPaymentParamsSchema>;

export const CheckoutSessionInputSchema = z.object({
  idempotencyKey: z.string().min(16).max(128),
  contactPhone: z
    .string()
    .trim()
    .regex(/^(?:\+[1-9]\d{7,14}|0\d{9})$/)
    .optional(),
});
export type CheckoutSessionInput = z.infer<typeof CheckoutSessionInputSchema>;
export { CheckoutSessionInputSchema as BookingPaymentInputSchema };
export type BookingPaymentInput = CheckoutSessionInput;

export const PaymentStatus = {
  PENDING: "PENDING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  REFUND_PENDING: "REFUND_PENDING",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
export const PAYMENT_STATUSES = Object.values(PaymentStatus);
export const PAYMENT_REFUND_REASONS = [
  "NO_CAPACITY",
  "CHECK_IN_CLOSED",
  "OFFERING_UNAVAILABLE",
  "CUSTOMER_CANCELLATION",
  "NO_SHOW",
  "RENEWAL_NOT_APPLIED",
] as const;
export type PaymentType = "CHARGE" | "DEPOSIT_REFUND" | "DEBT_COLLECTION";
export const PaymentTypeSchema = z.enum(["CHARGE", "DEPOSIT_REFUND", "DEBT_COLLECTION"]);
export const PaymentRefundReasonSchema = z.enum(PAYMENT_REFUND_REASONS);
export type PaymentRefundReason = z.infer<typeof PaymentRefundReasonSchema>;

export const ManualRefundQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ManualRefundQuery = z.infer<typeof ManualRefundQuerySchema>;
export const ConfirmManualRefundInputSchema = z.object({
  reference: z.string().trim().min(1, PAYMENT_CONTRACT_MESSAGES.refundReferenceRequired).max(128),
});
export type ConfirmManualRefundInput = z.infer<typeof ConfirmManualRefundInputSchema>;

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

// Preserve other HTTP headers, including the account session cookie.
export const PaymentStatusHeadersSchema = z
  .object({
    "x-booking-access-token": z
      .string()
      .regex(/^[a-f0-9]{64}$/, PAYMENT_CONTRACT_MESSAGES.checkoutAccessTokenInvalid)
      .optional(),
  })
  .passthrough();
export type PaymentStatusHeaders = z.infer<typeof PaymentStatusHeadersSchema>;

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
  type: PaymentTypeSchema,
  reservationId: z.uuid().optional(),
  paymentId: z.string().uuid(),
  status: z.enum(PaymentStatus),
  provider: z.string().nullable(),
  paymentCode: z.string().nullable(),

  transferInstructions: SepayPaymentInstructionsSchema.optional(),
  checkoutUrl: z.string().url().optional(),
  checkoutFormFields: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  confirmation: z.lazy(() => BookingConfirmationSchema).optional(),
});

export const ManualPaymentInputSchema = z
  .strictObject({
    method: z.enum(["CASH", "BANK_TRANSFER"]),
    reference: z.string().trim().min(1).max(128).optional(),
  })
  .refine((input) => input.method !== "BANK_TRANSFER" || Boolean(input.reference), {
    message: PAYMENT_CONTRACT_MESSAGES.refundReferenceRequired,
    path: ["reference"],
  });
export const DebtPaymentInputSchema = ManualPaymentInputSchema.safeExtend({
  amount: z.number().int().positive().max(999_999_999_999),
  idempotencyKey: z.string().min(16).max(123),
});
export type DebtPaymentInput = z.infer<typeof DebtPaymentInputSchema>;
export const DebtQuerySchema = z.object({
  rentalId: z.uuid().optional(),
  status: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type DebtQuery = z.infer<typeof DebtQuerySchema>;
export type DebtRecord = {
  id: string;
  rentalId: string;
  customerId: string;
  customerName: string;
  unitCode: string;
  originalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  currency: string;
  createdAt: string;
};
export type DebtPaymentRecord = {
  id: string;
  totalAmount: string;
  method: "CASH" | "BANK_TRANSFER" | null;
  reference: string | null;
  paidAt: string | null;
};
export type DebtDetail = DebtRecord & { payments: DebtPaymentRecord[] };
