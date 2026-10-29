export const FACILITY_TASK_MESSAGES = {
  appointmentWorkflowRequired:
    "Update appointment assignment and completion through the appointment workflow.",
  taskCancelled: "Đã hủy công việc.",
  taskNotReady: "Công việc chưa ở trạng thái phù hợp để thực hiện thao tác này.",
  handoverTaskAutomatic:
    "Công việc check-in và bàn giao được tạo khi FM phân công nhân viên cho booking.",
  accessDenied: "Bạn không có quyền truy cập công việc này.",
  managerScopeRequired: "Chỉ FM đang được phân công tại cơ sở mới được giao công việc.",
  staffUnavailable: "Nhân viên phải đang hoạt động và có phân công còn hiệu lực tại cơ sở này.",
  contextMismatch: "Đối tượng tham chiếu không tồn tại hoặc không thuộc cơ sở của công việc.",
  taskNotFound: "Không tìm thấy công việc.",
  createSummary: "FM giao công việc kiểm tra hoặc hỗ trợ cho nhân viên tại cơ sở",
  myTasksSummary: "Nhân viên xem công việc được giao",
  facilityTasksSummary: "FM xem công việc tại cơ sở",
  myDashboardSummary: "Nhân viên xem số công việc còn mở được giao hôm nay theo loại",
  updateSummary: "Cập nhật loại, nhân viên phụ trách hoặc trạng thái công việc",
  updated: "Đã cập nhật công việc.",
  created: "Đã tạo và phân công công việc.",
  success: "Yêu cầu thành công.",
  invalidInput: "Dữ liệu đầu vào, nhân viên hoặc ngữ cảnh công việc không hợp lệ.",
  loginRequired: "Cần đăng nhập bằng tài khoản đang hoạt động.",
  persistenceFailed: "Không thể lưu phân công công việc.",
} as const;
