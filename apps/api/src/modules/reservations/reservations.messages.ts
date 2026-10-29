export const RESERVATION_RECORD_MESSAGES = {
  notFound: "Reservation not found.",
  futureDateRequired: "The check-in date must be tomorrow or later.",
  invalidSlot: "The selected appointment slot is invalid or has already started.",
  capacityUnavailable: "No storage capacity is available for this period.",
  amountOutOfRange: "The reservation amount exceeds the supported range.",
  writeFailed: "Unable to save the reservation.",
  cancellationClosed: "Only draft or confirmed reservations can be cancelled before handover.",
} as const;
