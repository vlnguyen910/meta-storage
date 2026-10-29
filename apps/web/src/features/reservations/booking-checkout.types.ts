import type { ReservationPaymentSession, ReservationRecordDto } from "@metastorage/contracts";

export interface CheckoutContext {
  draft: ReservationRecordDto;
  checkInDate: string;
  checkInSlotId: string;
  idempotencyKey: string;
  contactPhone?: string;
  payment?: ReservationPaymentSession;
}
