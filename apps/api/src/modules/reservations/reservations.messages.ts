export const RESERVATION_RECORD_MESSAGES = {
  notFound: "Reservation not found.",
  unitTypeNotFound: "Active unit type not found at this facility.",
  futureStart: "Reservation start must be in the future.",
  draftOnly: "Only draft reservations can be edited.",
  facilityRequired: "A facility must be selected.",
  invalidStatus: "Reservation status is invalid.",
} as const;
