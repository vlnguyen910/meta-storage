export const BOOKING_EMAIL_MESSAGES = {
  sendFailed: "Booking confirmation delivery failed; retry is scheduled if attempts remain.",
  providerConfiguration:
    "Configure RESEND_API_KEY and RESEND_FROM_EMAIL for booking confirmation email.",
  accessConfiguration:
    "Configure BOOKING_MAGIC_LINK_SECRET (at least 32 characters) and PUBLIC_APP_URL.",
  payloadConfiguration:
    "Configure BOOKING_MAGIC_LINK_SECRET (at least 32 characters), matching the API mail payload secret.",
  accessExpired: "The booking tracking link delivery has expired.",
  preparationFailed: "Booking confirmation could not be prepared; retry is pending.",
} as const;
