import type { RentalPaymentItem } from "@metastorage/contracts";

export type GuestRentalPaymentItem = Omit<RentalPaymentItem, "provider">;

export interface GuestIssuedContract {
  id: string;
  version: number;
  filename: string;
  byteSize: number;
  issuedAt: string | null;
}
