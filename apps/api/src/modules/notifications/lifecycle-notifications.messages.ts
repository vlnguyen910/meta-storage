import type { LifecycleNotificationEvent } from "@metastorage/contracts";

export const LIFECYCLE_NOTIFICATION_SUBJECTS: Record<LifecycleNotificationEvent, string> = {
  SUPPORT_UPDATED: "STOREX — Cập nhật phiếu hỗ trợ",
  SUPPORT_CREATED: "STOREX — Đã tiếp nhận phiếu hỗ trợ",
  PAYMENT_CONFIRMED: "STOREX — Thanh toán đã được xác nhận",
  BOOKING_CONFIRMED: "STOREX — Booking đã được xác nhận",
  UPCOMING_EXPIRY: "STOREX — Kho thuê sắp hết hạn",
  RENTAL_OVERDUE: "STOREX — Kho thuê đã quá hạn",
  ABANDONED_REVIEW: "STOREX — Kho quá hạn cần xem xét thủ công",
  RETURN_SCHEDULED: "STOREX — Lịch trả kho đã được xác nhận",
  RETURN_CHANGED: "STOREX — Yêu cầu trả kho được cập nhật",
  RETURN_INSPECTION: "STOREX — Kết quả kiểm tra trả kho",
  RETURN_SETTLED: "STOREX — Quyết toán trả kho được xác nhận",
  RETURN_REFUND: "STOREX — Khoản hoàn tiền được xác nhận",
  RETURN_TIME_CHANGED: "STOREX — Thời điểm trả kho được điều chỉnh",
};
export const lifecycleNotificationBody = (subject: string, bookingCode: string, detail: string) =>
  `${subject}\nBooking: ${bookingCode}${detail ? `\n${detail}` : ""}`;

export const lifecycleExpiryDetail = (date: string) => `Ngày hết hạn: ${date}`;
