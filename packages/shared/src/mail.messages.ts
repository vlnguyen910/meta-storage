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
  subject: (code: string | null) => `StoreX — Đặt kho thành công ${code ?? ""}`,
  title: "Đặt kho thành công",
  booking: "Mã đặt kho",
  facility: "Cơ sở",
  unitType: "Loại kho",
  tracking: "Xem thông tin đặt kho",
  trackingHint: "Vui lòng đăng nhập bằng tài khoản đã đặt kho để xem thông tin booking.",
  trackingLinkSubject: (code: string) => `StoreX — Liên kết truy cập đặt kho ${code}`,
  trackingLinkTitle: "Liên kết truy cập thông tin kho",
  trackingLinkHint: (expiresAt: string) =>
    `Liên kết hết hạn lúc ${expiresAt}. Không chia sẻ email này.`,
  checkIn: "Mã nhận kho",
} as const;
