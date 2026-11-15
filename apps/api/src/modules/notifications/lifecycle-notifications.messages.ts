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

export const LIFECYCLE_MAIL_DETAIL = {
  returnRequested: (date: string) => `Lịch trả kho được yêu cầu: ${date}`,
  appointmentUpdated: (kind: "return" | "support", date: string, status: string) => {
    const labels: Record<string, string> = {
      SCHEDULED: "Đã yêu cầu",
      CONFIRMED: "Đã xác nhận",
      COMPLETED: "Đã hoàn tất",
      CANCELLED: "Đã hủy",
      NO_SHOW: "Không đến hẹn",
    };
    return `${kind === "return" ? "Lịch trả kho" : "Lịch hỗ trợ"} ${date}: ${labels[status] ?? status}`;
  },
  supportScheduled: (date: string) => `Đã đặt lịch hỗ trợ: ${date}`,
  refund: (amount: string | number, currency: string) =>
    `Đã xác nhận hoàn tiền: ${amount} ${currency}`,
  settlement: (deposit: number, deduction: number, refund: number, currency: string) =>
    `Tiền cọc: ${deposit} ${currency}\nKhấu trừ: ${deduction} ${currency}\nHoàn cọc: ${refund} ${currency}\nCông nợ: ${Math.max(0, deduction - deposit)} ${currency}`,
};
