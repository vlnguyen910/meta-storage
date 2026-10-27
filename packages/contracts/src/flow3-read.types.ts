import type { RentalPaymentItem } from "./rentals.types";

export type GuestRentalPaymentItemDto = Omit<RentalPaymentItem, "provider">;
export interface GuestIssuedContractDto {
  id: string;
  version: number;
  filename: string;
  byteSize: number;
  issuedAt: string | null;
}
export interface PrivateReturnPhotoDto {
  id: string;
  filename: string;
  url: string;
}
