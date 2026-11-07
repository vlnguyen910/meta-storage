import type { PaymentStatus } from "./payments";

export type CheckInSlotOption = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
};

export type BookingClosure = {
  bookingId: string;
  status: "CANCELLED" | "NO_SHOW";
  payment: {
    paymentId: string;
    status: "REFUND_PENDING" | "REFUNDED";
    refundAmount: string;
    depositForfeitedAmount: string;
    currency: string;
  };
};

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
  payment: {
    status: "SUCCEEDED" | "REFUND_PENDING" | "REFUNDED";
    paidAt: string;
    refundAmount: string | null;
    depositForfeitedAmount: string;
  };
}
export type CustomerBooking = {
  id: string;
  bookingCode: string | null;
  status: "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "CHECKED_IN";
  facility: { id: string; name: string; address: string };
  unitType: { id: string; name: string; sizeLabel: string };
  checkInSlotStart: string;
  checkInSlotEnd: string;
  rentalEndAt: string;
  durationMonths: number;
  pricing: BookingDraftPricing;
  paymentStatus: PaymentStatus | "NOT_STARTED";
  paidAt: string | null;
  assignedUnit: { code: string; assignedAt: string } | null;
  handoverStage: "WAITING_CUSTOMER" | "INSPECTING" | "READY_HANDOVER" | "HANDED_OVER";
  createdAt: string;
};

export type CustomerBookingDetail = CustomerBooking & {
  rentalId: string | null;
  confirmation: import("./bookings").BookingConfirmation | null;
};

export type CustomerBookingPageCursor = {
  afterCreatedAt: string;
  afterId: string;
};

export type CustomerBookingPage = {
  items: CustomerBooking[];
  nextCursor: CustomerBookingPageCursor | null;
};
