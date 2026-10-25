import type {
  BookingDraft,
  BookingPaymentSession,
  PaymentStatusResponse,
  ReservationDraftContact,
} from "@metastorage/contracts";

export interface MockCheckout {
  draft: BookingDraft;
  contact?: ReservationDraftContact;
  key?: string;
  payment?: BookingPaymentSession;
  status?: PaymentStatusResponse;
}
