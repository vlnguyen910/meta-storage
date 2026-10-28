export const APPOINTMENT_MESSAGES = {
  notFound: "Appointment not found.",
  contextNotFound: "The linked reservation, rental, or support ticket was not found.",
  contextMismatch: "Appointment does not match the linked record.",
  slotNotFound: "Appointment slot not found.",
  staffInvalid: "Staff member is not assigned to this facility.",
  transitionInvalid: "Appointment status transition is not allowed.",
  duplicate: "An appointment already exists for this reservation or slot.",
  invalidType: "Appointment type is invalid.",
  invalidStatus: "Appointment status is invalid.",
} as const;
