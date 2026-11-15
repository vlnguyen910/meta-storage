export const LIFECYCLE_MAIL_MESSAGES = {
  brand: "MetaStorage",
  footer: "Email tự động từ MetaStorage. Vui lòng liên hệ cơ sở nếu bạn cần hỗ trợ.",
  expiryBody: (id: string, endAt: Date) =>
    `Kỳ thuê: ${id}\nNgày hết hạn: ${endAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}\nVui lòng kiểm tra kỳ thuê và sắp xếp trả kho trước khi hết hạn.`,
} as const;

export const LIFECYCLE_MAIL_TEMPLATES = {
  UPCOMING_EXPIRY: {
    title: "Kỳ thuê sắp hết hạn",
    intro: "Kỳ thuê của bạn sẽ kết thúc trong vòng 7 ngày tới.",
    label: "NHẮC HẠN",
  },
  SUPPORT_CREATED: {
    title: "Đã tiếp nhận yêu cầu hỗ trợ",
    intro: "Yêu cầu của bạn đã được ghi nhận để xử lý.",
    label: "HỖ TRỢ",
  },
  SUPPORT_UPDATED: {
    title: "Yêu cầu hỗ trợ có cập nhật",
    intro: "Có thông tin mới về lịch xử lý yêu cầu hỗ trợ của bạn.",
    label: "HỖ TRỢ",
  },
  RETURN_SCHEDULED: {
    title: "Lịch trả kho đã được xác nhận",
    intro: "Vui lòng chuẩn bị đồ đạc và đến cơ sở theo lịch đã xác nhận.",
    label: "TRẢ KHO",
  },
  RETURN_CHANGED: {
    title: "Cập nhật lịch trả kho",
    intro: "Thông tin lịch trả kho của bạn vừa được cập nhật.",
    label: "TRẢ KHO",
  },
  RETURN_SETTLED: {
    title: "Đã hoàn tất trả kho và quyết toán",
    intro: "Kỳ thuê đã đóng. Dưới đây là thông tin quyết toán tiền cọc và các khoản phát sinh.",
    label: "QUYẾT TOÁN",
  },
  RETURN_REFUND: {
    title: "Đã xác nhận hoàn tiền",
    intro: "Khoản hoàn tiền của bạn đã được ghi nhận hoàn tất.",
    label: "HOÀN TIỀN",
  },
} as const;
