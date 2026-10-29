import { ReservationStatus as ReservationStatusEnum } from "@metastorage/database/schema/reservations";
import { z } from "zod";
import type { Facility } from "./facilities";
import type { Payment } from "./payments";
import type { BookingPaymentSession } from "./payments.types";

export type ReservationPaymentSession = Omit<BookingPaymentSession, "bookingId"> & {
  reservationId: string;
};

export { ReservationStatusEnum as ReservationStatus };
export const ReservationStatusSchema = z.enum(ReservationStatusEnum);

export const CreateReservationSchema = z.object({
  facilityId: z.uuid(),
  unitTypeId: z.uuid(),
  requestedMonths: z.number().int().min(1).max(12),
  rentalStartAt: z.iso.datetime(),
});
export const ReservationIdSchema = z.object({ id: z.uuid() });
export const ReservationQuerySchema = z.object({
  facilityId: z.uuid().optional(),
  status: ReservationStatusSchema.optional(),
});
export const UpdateReservationSchema = z.object({
  status: z.literal(ReservationStatusEnum.CANCELLED),
});
export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;
export type ReservationQuery = z.infer<typeof ReservationQuerySchema>;
export type UpdateReservationInput = z.infer<typeof UpdateReservationSchema>;
export interface ReservationDraft {
  id: string;
  facilityId: string;
  unitTypeId: string;
  checkInAt: string;
  rentalEndAt: string;
  durationMonths: number;
  status: "DRAFT";
  pricingStatus: "PRICED";
  pricing?: {
    monthlyRateSnapshot: string;
    rentalFeeAmount: string;
    depositAmount: string;
    totalAmount: string;
    currency: string;
  };
  draftAccessToken: string;
  contact: ReservationDraftContact;
}
export interface ReservationHold {
  draftId?: string;
  holdId: string;
  holdToken: string;
  unitTypeId: string;
  startsAt: string;
  endsAt: string;
  expiresAt: string;
  status: "ACTIVE";
}

export interface Reservation {
  id: string;
  code: string;
  userId: string;
  facility: Facility;
  unitTypeId: string;
  unitType: string;
  sizeLabel: string;
  startDate: string;
  endDate: string;
  durationMonths: number;
  status: ReservationStatusEnum;
  monthlyPrice: number;
  depositAmount: number;
  totalEstimated: number;
  payment: Payment;
  createdAt: string;
}

export const ReservationDraftInputSchema = z.object({
  facilityId: z.uuid(),
  unitTypeId: z.uuid(),
  checkInAt: z.iso.datetime(),
  durationMonths: z.number().int().min(1).max(12),
  contact: z.object({ fullName: z.string(), email: z.email(), phone: z.string() }).optional(),
});
export type ReservationDraftInput = z.infer<typeof ReservationDraftInputSchema>;
export interface ReservationDraftContact {
  fullName: string;
  email: string;
  phone: string;
}
export type ReservationQuoteInput = Pick<
  ReservationDraftInput,
  "facilityId" | "unitTypeId" | "durationMonths"
> & {
  startDate: string;
};
export interface ReservationQuote extends ReservationQuoteInput {
  id: string;
  unitType: string;
  sizeLabel: string;
  monthlyPrice: number;
  rentalTotal: number;
  depositAmount: number;
  totalEstimated: number;
  expiresAt: string;
}
export interface ConfirmReservationInput {
  quoteId: string;
  paymentToken: string;
  cardBrand: string;
  cardLast4: string;
}

// Dates are serialized by the API; database records retain Date internally.
export type ReservationRecordDto = Omit<
  import("@metastorage/database/schema/reservations").ReservationRecord,
  "rentalStartAt" | "rentalEndAt" | "createdAt" | "updatedAt"
> & {
  facility?: { id: string; name: string; address: string };
  unitType?: { id: string; name: string; sizeLabel: string };
  paymentStatus?: string | null;
  rentalStartAt: string;
  rentalEndAt: string;
  createdAt: string;
  updatedAt: string;
};

export const CreateReservationDraftSchema = z.object({
  facilityId: z.string().uuid(),
  unitTypeId: z.string().uuid(),
  checkInSlotId: z.string().uuid(),
  checkInDate: z.iso.date(),
  durationMonths: z.number().int().min(1).max(12),
});

export type CreateReservationDraftInput = z.infer<typeof CreateReservationDraftSchema>;
