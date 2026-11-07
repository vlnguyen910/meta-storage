export const BOOKING_CONTRACT_MESSAGES = {
  invalidDateRange: "Ngày bắt đầu không được sau ngày kết thúc.",
  invalidMagicToken: "Liên kết tra cứu không hợp lệ.",
  invalidBookingCode: "Mã đặt kho không hợp lệ.",
  incompleteCustomerBookingCursor:
    "Cần gửi đồng thời afterCreatedAt và afterId để phân trang booking.",
} as const;
