import type { BookingDraft, BookingPaymentSession } from "@metastorage/contracts";

export interface CheckoutContext {
  draft: BookingDraft;
  checkInDate: string;
  checkInSlotId: string;
  idempotencyKey: string;
  payment?: BookingPaymentSession;
}
