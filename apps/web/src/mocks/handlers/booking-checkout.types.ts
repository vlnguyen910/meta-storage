import type {
  BookingDraft,
  BookingPaymentInput,
  BookingPaymentSession,
  PaymentStatusResponse,
} from "@metastorage/contracts";

export interface MockCheckout {
  draft: BookingDraft;
  contact?: BookingPaymentInput["contact"];
  key?: string;
  payment?: BookingPaymentSession;
  status?: PaymentStatusResponse;
}
