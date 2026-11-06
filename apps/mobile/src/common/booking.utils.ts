import type {
  ApiUnitType,
  PaymentStatusResponse,
  ReservationRecordDto,
  SepayPaymentInstructions,
} from "@metastorage/contracts";
import { CreateReservationDraftSchema } from "@metastorage/contracts";
import { isAxiosError } from "axios";
import { z } from "zod";
import { BOOKING as M } from "../features/booking/booking.messages";
import type { SavedBooking } from "./booking.types";

export const savedBookingSchema = CreateReservationDraftSchema.extend({
  draftId: z.uuid(),
  key: z.string().min(16).max(128),
  contactPhone: z.string().max(20),
  paymentRequested: z.boolean().optional(),
  payment: z
    .object({
      paymentId: z.uuid(),
      reservationId: z.uuid(),
      paymentCode: z.string(),
      expiresAt: z.iso.datetime(),
    })
    .optional(),
}).refine((value) => !value.payment || value.payment.reservationId === value.draftId);
export function unitAreaMatches(unit: ApiUnitType, filter: string) {
  const area = unit.lengthM * unit.widthM;
  return (
    filter === "all" ||
    (filter === "small" && area < 3) ||
    (filter === "medium" && area >= 3 && area <= 6) ||
    (filter === "large" && area > 6)
  );
}
export function bookingError(error: unknown) {
  if (isAxiosError(error))
    return !error.response
      ? M.network
      : error.response.status === 401
        ? M.identity
        : error.response.status === 409
          ? M.conflict
          : M.error;
  return error instanceof Error && Object.values(M).some((message) => message === error.message)
    ? error.message
    : M.error;
}
export function paymentQrUrl(instructions?: SepayPaymentInstructions) {
  if (
    !instructions?.accountNumber ||
    instructions.currency !== "VND" ||
    !instructions.content.trim() ||
    !instructions.bankName ||
    !Number.isSafeInteger(Number(instructions.amount)) ||
    Number(instructions.amount) <= 0
  )
    return undefined;
  const url = new URL("https://vietqr.app/img");
  for (const [key, value] of Object.entries({
    acc: instructions.accountNumber,
    bank: instructions.bankName,
    amount: instructions.amount,
    des: instructions.content,
    template: "qronly",
  }))
    url.searchParams.set(key, value);
  return url.toString();
}
export function gatewaySource(url: string, fields: Record<string, string | number>) {
  if (new URL(url).protocol !== "https:") throw new Error(M.gatewayError);
  return {
    uri: url,
    method: "POST" as const,
    body: new URLSearchParams(
      Object.entries(fields).map(([key, value]) => [key, String(value)]),
    ).toString(),
  };
}
export function isGatewayReturn(url: string, fields: Record<string, string | number>) {
  return ["success_url", "error_url", "cancel_url"].some((key) => {
    if (typeof fields[key] !== "string") return false;
    try {
      const expected = new URL(fields[key]),
        actual = new URL(url);
      return (
        Boolean(expected.searchParams.get("paymentId")) &&
        expected.origin === actual.origin &&
        expected.pathname === actual.pathname &&
        expected.searchParams.get("paymentId") === actual.searchParams.get("paymentId")
      );
    } catch {
      return false;
    }
  });
}

export function isBookingPayment(
  result: PaymentStatusResponse,
  payment: NonNullable<SavedBooking["payment"]>,
) {
  return (
    result.type === "CHARGE" &&
    result.paymentId === payment.paymentId &&
    result.reservationId === payment.reservationId
  );
}
export function isPaidReservation(record: ReservationRecordDto) {
  return (
    record.paymentStatus === "SUCCEEDED" && ["CONFIRMED", "CHECKED_IN"].includes(record.status)
  );
}
