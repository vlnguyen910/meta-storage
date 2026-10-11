export const BOOKING_EMAIL_MESSAGES = {
  sendFailed: "Booking confirmation delivery failed; retry is scheduled if attempts remain.",
  providerConfiguration:
    "Configure RESEND_API_KEY and RESEND_FROM_EMAIL for booking confirmation email.",
  accessConfiguration:
    "Configure BOOKING_MAGIC_LINK_SECRET (at least 32 characters) and PUBLIC_APP_URL.",
  accessExpired: "The booking tracking link delivery has expired.",
  subject: (code: string | null) => `StoreX — Đặt kho thành công ${code ?? ""}`,
  title: "Đặt kho thành công",
  booking: "Mã đặt kho",
  facility: "Cơ sở",
  unitType: "Loại kho",
  tracking: "Xem thông tin đặt kho",
  trackingHint:
    "Liên kết có hiệu lực trong 7 ngày. Bất kỳ ai có liên kết đều có thể xem thông tin đặt kho; vui lòng không chia sẻ.",
  checkIn: "Mã nhận kho",
} as const;
