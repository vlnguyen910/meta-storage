export type BookingDraftPricing = {
  monthlyRateSnapshot: string;
  rentalFeeAmount: string;
  depositAmount: string;
  totalAmount: string;
  currency: "VND";
};

export type BookingDraft = {
  id: string;
  facilityId: string;
  unitTypeId: string;
  checkInAt: string;
  rentalEndAt: string;
  durationMonths: number;
  draftAccessToken: string;
  status: "DRAFT";
  pricing: BookingDraftPricing;
};

export interface BookingTrackingSession {
  bookingCode: string;
  expiresAt: string;
  booking: BookingTracking;
}

export interface BookingTracking {
  bookingCode: string;
  status: "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "CHECKED_IN";
  facility: { name: string; address: string };
  unitType: { name: string; sizeLabel: string };
  checkInSlotStart: string;
  checkInSlotEnd: string;
  rentalEndAt: string;
  durationMonths: number;
  contact: { fullName: string; email: string; phone: string };
  pricing: BookingDraftPricing;
  payment: { status: "SUCCEEDED" | "REFUNDED"; paidAt: string };
}
