import type { RentalListItem, RentalPaymentItem } from "@metastorage/contracts";

export interface CustomerTransaction {
  rental: RentalListItem;
  payment: RentalPaymentItem;
}
