export const RENTAL_MESSAGES = {
  readOnly: "Hồ sơ thuê hiện chỉ hỗ trợ xem thông tin.",
  facilityAccessDenied: "Bạn không có quyền theo dõi hợp đồng thuê tại cơ sở này.",
  rentalNotFound: "Không tìm thấy Rental",
  rentalNotActive: "Rental must be active to schedule a return appointment.",
} as const;

export const RENTAL_RENEWAL_MESSAGES = {
  rentalNotFound: "Không tìm thấy rental",
  requestWindowClosed: "Rental không còn trong thời hạn được yêu cầu gia hạn.",
  unavailable: "Không thể gia hạn rental hiện tại.",
  returnOpen: "Bạn đang có yêu cầu trả kho. Hãy xử lý yêu cầu đó trước khi gia hạn.",
  capacityUnavailable: "Không còn capacity cho khoảng thời gian gia hạn.",
  quoteExpired: "Báo giá đã hết hạn. Vui lòng lấy báo giá mới.",
  changed: "Thông tin kỳ thuê đã thay đổi. Vui lòng tải lại trước khi gia hạn.",
  paymentOpen: "Đã có phiên thanh toán gia hạn đang chờ xử lý.",
  idempotencyConflict: "Mã yêu cầu đã được sử dụng cho nội dung khác.",
  keyConflict: "Idempotency key đã được dùng với dữ liệu khác.",
  quoteSaveFailed: "Không thể lưu báo giá gia hạn.",
  renewalNotFound: "Không tìm thấy yêu cầu gia hạn",
  unitUnavailable: "Kho đang thuê không còn đủ điều kiện gia hạn.",
} as const;
