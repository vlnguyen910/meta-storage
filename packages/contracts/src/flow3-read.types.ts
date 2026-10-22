import type { RentalPaymentItem } from "./rentals.types";

export type GuestRentalPaymentItemDto = Omit<RentalPaymentItem, "provider">;
export interface GuestIssuedContractDto {
  id: string;
  version: number;
  filename: string;
  byteSize: number;
  issuedAt: string | null;
}
export interface ReturnCalendarDto {
  facilityId: string;
  timezone: string;
  holidays: string[];
  reminderTime: string;
  version: number;
  operatingHours: Array<{ dayOfWeek: number; openTime: string; closeTime: string }>;
}
export interface PrivateReturnPhotoDto {
  id: string;
  filename: string;
  url: string;
}
