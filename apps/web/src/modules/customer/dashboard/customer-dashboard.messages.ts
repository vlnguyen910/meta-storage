export const CUSTOMER_DASHBOARD_MESSAGES = {
  bookingStatus: {
    CONFIRMED: "Đã xác nhận",
    CHECKED_IN: "Đã check-in",
    NO_SHOW: "Không đến",
    CANCELLED: "Đã hủy",
  },
  bookingStatusClass: {
    CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-800",
    CHECKED_IN: "border-sky-200 bg-sky-50 text-sky-800",
    NO_SHOW: "border-rose-200 bg-rose-50 text-rose-800",
    CANCELLED: "border-slate-200 bg-slate-100 text-slate-700",
  },
  paymentSucceeded: "Đã thanh toán",
  paymentPending: "Thanh toán đang xử lý",
} as const;
