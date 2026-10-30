export const APPOINTMENT_MESSAGES = {
  handoverRequired:
    "The reservation must be handed over before completing its check-in appointment.",
  returnRequired:
    "The rental return must be finalized before completing its check-out appointment.",
  notFound: "Appointment not found.",
  invalidSlot: "The appointment slot is invalid or has already started.",
  reservationNotConfirmed: "The reservation is not eligible for this appointment operation.",
  scheduleMismatch: "The appointment does not match the reservation or rental period.",
  contextMismatch: "The appointment context belongs to another facility.",
  alreadyScheduled: "An active appointment already exists for this request.",
  slotUnavailable: "Another confirmed return appointment already occupies this facility slot.",
  writeFailed: "Unable to save the appointment.",
  accessDenied: "You cannot perform this appointment operation.",
  emptyUpdate: "Provide at least one appointment change.",
  closed: "The appointment is closed.",
  invalidTransition: "This appointment status transition is not allowed.",
  completionNotReady:
    "Only assigned staff can complete a confirmed appointment during its scheduled day after starting the task.",
  noShowNotReady: "A manager can mark no-show only after the appointment slot ends.",
  cancellationClosed: "Customers must cancel before the appointment starts.",
  staffRequired: "Assign staff before confirming the appointment.",
} as const;
