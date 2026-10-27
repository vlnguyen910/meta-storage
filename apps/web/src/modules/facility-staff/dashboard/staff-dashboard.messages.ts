export const STAFF_DASHBOARD_MESSAGES = {
  assignmentsFailed: "Không thể tải danh sách cơ sở được phân công.",
  tabTasks: "Nhiệm vụ Check-in & Bàn giao",
  tabOverview: "Tổng quan",
  navAriaLabel: "Các mục làm việc của nhân viên cơ sở",
  previous: "Trang trước",
  next: "Trang sau",
  pageOf: (page: number, total: number) => `Trang ${page}/${total}`,
} as const;
