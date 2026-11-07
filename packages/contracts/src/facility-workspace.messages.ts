export const FACILITY_WORKSPACE_MESSAGES = {
  denied: "Bạn không có quyền thực hiện thao tác tại cơ sở này.",
  missing: "Không tìm thấy hồ sơ trong phạm vi được phân công.",
  stale: "Hồ sơ đã thay đổi. Vui lòng tải lại trước khi tiếp tục.",
  state: "Trạng thái hiện tại không cho phép thao tác này.",
  staff: "Nhân viên phải đang hoạt động và thuộc cùng cơ sở.",
  report: "Cần duyệt báo cáo mới nhất của phân công hiện tại.",
  required: "Vui lòng nhập nội dung hoặc lý do từ 3 ký tự.",
  notification: "STOREX — Cập nhật phiếu hỗ trợ",
  updated: (id: string) => `Phiếu hỗ trợ ${id} có cập nhật mới. Mở phiếu để xem chi tiết.`,
} as const;
