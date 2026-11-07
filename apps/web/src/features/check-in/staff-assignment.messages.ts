export const STAFF_ASSIGNMENT_MESSAGES = {
  title: "Chỉ định nhân viên phụ trách",
  choose: "Chọn nhân viên cơ sở",
  invalidStaff: "Vui lòng chọn nhân viên hợp lệ từ danh sách.",
  loading: "Đang tải nhân viên cơ sở…",
  loadError: "Không thể tải danh sách nhân viên cơ sở.",
  empty: "Chưa có nhân viên đang hoạt động được phân công tại cơ sở này.",
  staff: "nhân viên",
  taskCount: (count: number) =>
    count === 0 ? "Sẵn sàng (0 việc)" : `Đang phụ trách: ${count} việc`,
  cancel: "Hủy",
  confirm: "Xác nhận chỉ định",
  success: (name: string, code: string) => `Đã chỉ định ${name} phụ trách đơn ${code}.`,
} as const;
