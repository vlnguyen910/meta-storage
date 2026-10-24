export const RENEWAL_MESSAGES = {
  notFound: "Không tìm thấy yêu cầu gia hạn hoặc kho thuê.",
  ineligible: "Kho thuê không đủ điều kiện gia hạn.",
  cutoff: "Đã qua hạn gia hạn trước ngày hết hạn 6 ngày.",
  expired: "Báo giá gia hạn đã hết hạn. Vui lòng tạo báo giá mới.",
  returnStarted: "Không thể gia hạn kho đã có yêu cầu trả kho.",
  debt: "Vui lòng thanh toán hết công nợ trả kho trước khi gia hạn.",
  capacity: "Không còn khả năng giữ nguyên unit cho kỳ gia hạn.",
  stale: "Kỳ thuê đã thay đổi. Vui lòng tạo báo giá mới.",
  idempotency: "Mã yêu cầu đã được dùng cho một kỳ gia hạn khác.",
  configuration: "Chưa cấu hình múi giờ hoặc giá thuê cho cơ sở.",
  immutableCharge: "Khoản gia hạn sử dụng báo giá đã xác nhận, không được điều chỉnh thủ công.",
  persistence: "Không thể lưu yêu cầu gia hạn.",
  refundRequired: "Đã nhận tiền nhưng không thể áp dụng gia hạn; cần hoàn tiền có kiểm soát.",
  termsVersion: "STOREX_RENEWAL_V1_2026_10_24",
  terms:
    "Gia hạn cùng unit; mỗi tháng bằng 30 ngày; không thu thêm cọc; không hoàn tiền thuê khi trả sớm.",
} as const;
