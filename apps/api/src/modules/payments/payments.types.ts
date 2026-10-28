import type { BookingConfirmation, BookingPaymentInput } from "@metastorage/contracts";
import type { Payment } from "@metastorage/database";
import type { BookingReadRecord } from "../bookings/bookings.types";

export type CompletedPayment = {
  payment: Payment;
  booking: BookingReadRecord;
  confirmation: BookingConfirmation;
};

export type PaymentStatusCredentials = {
  userId?: string;
};

export type PaymentStatusAccess = {
  userId?: string;
};

export type PrepareBookingPaymentInput = {
  bookingId: string;
  userId: string;
  holdTokenHash: string;
  idempotencyKey: string;
  contactPhone?: BookingPaymentInput["contactPhone"];
  paymentCode: string;
  holdDurationMs: number;
};

export type GatewayPaymentResult = {
  providerPaymentId: string;
  status: "SUCCEEDED" | "FAILED";
};

export type PaymentInstructions = {
  paymentCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  amount: string;
  currency: string;
  content: string;
  expiresAt: string;
};

export type VerifiedPaymentEvent = {
  providerEventId: string;
  paymentCode: string;
  amount: number;
  transferType: "in" | "out";
  referenceCode: string | null;
  metadata: Record<string, unknown>;
  currency?: string;
  successful?: boolean;
  paidAt?: Date;
};

export type BookingWebhookResult = {
  duplicate: boolean;
  processed: boolean;
  paymentId?: string;
  completed?: CompletedPayment;
};

export interface PaymentGateway {
  readonly provider: string;
  charge(input: {
    amount: string;
    currency: string;
    paymentMethodToken: string;
    idempotencyKey: string;
  }): Promise<GatewayPaymentResult>;
}

export type SepayWebhookPayload = {
  notification_type?: string;
  order?: {
    order_invoice_number?: string;
    order_amount?: number | string;
    order_currency?: string;
    order_status?: string;
    [key: string]: unknown;
  };
  transaction?: {
    transaction_id?: string | number;
    transaction_amount?: number | string;
    transaction_currency?: string;
    transaction_status?: string;
    transaction_type?: string;
    payment_method?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type SepayGatewayConfig = {
  paymentPrefix: string;
  env?: "sandbox" | "production";
  merchantId?: string;
  secretKey?: string;
  webUrl?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
};

export type SepayCheckoutSession = {
  checkoutUrl: string;
  formFields: Record<string, string | number>;
};

export type SepayCreateCheckoutInput = {
  paymentCode: string;
  amount: number;
  currency: string;
  description: string;
  paymentId: string;
  bookingId?: string;
};

export type SepayOrderDetailResponse = {
  data?: {
    order_id?: string;
    order_invoice_number?: string;
    order_status?: string;
    order_amount?: string | number;
    order_currency?: string;
    transactions?: Array<{
      id?: string | number;
      transaction_type?: string;
      transaction_status?: string;
      transaction_date?: string;
    }>;
  };
};

export type SepayPaymentInstructions = PaymentInstructions & { provider: "sepay" };
export type SepayVerifiedPaymentEvent = VerifiedPaymentEvent & { provider: "sepay" };

export type PricingSnapshot = {
  monthlyRateSnapshot: string;
  rentalFeeAmount: string;
  depositAmount: string;
  totalAmount: string;
  currency: string;
};
