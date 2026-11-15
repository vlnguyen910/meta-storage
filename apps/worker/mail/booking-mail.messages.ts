export const BOOKING_MAIL_MESSAGES = {
  subject: (code: string | null) => `StoreX — Đặt kho thành công ${code ?? ""}`,
  title: "Đặt kho thành công",
  booking: "Mã đặt kho",
  facility: "Cơ sở",
  unitType: "Loại kho",
  tracking: "Xem thông tin đặt kho",
  trackingHint: "Vui lòng đăng nhập bằng tài khoản đã đặt kho để xem thông tin booking.",
  checkIn: "Mã nhận kho",
} as const;
