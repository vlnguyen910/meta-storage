import type { DashboardSummary } from "@metastorage/contracts";

export function facilityStaffDashboard(facilityName?: string): DashboardSummary {
  return {
    title: "Công việc hôm nay",
    subtitle: "Theo dõi các lịch hẹn và nhiệm vụ tại cơ sở được phân công.",
    facilityName,
    kpis: [
      { label: "Lịch check-in", value: "6", helper: "2 lịch trong 2 giờ tới", tone: "primary" },
      { label: "Lịch trả kho", value: "3", helper: "1 yêu cầu cần xác nhận", tone: "warning" },
      { label: "Nhiệm vụ", value: "8", helper: "5 nhiệm vụ đã hoàn tất", tone: "accent" },
      { label: "Yêu cầu hỗ trợ", value: "4", helper: "Không có yêu cầu quá hạn", tone: "neutral" },
    ],
    activities: [
      {
        id: "a1",
        title: "Kiểm tra kho HCM-01-006",
        description: "Được giao bởi quản lý cơ sở",
        time: "08:30",
      },
      {
        id: "a2",
        title: "Bàn giao lịch hẹn RS-2401",
        description: "Khách hàng Nguyễn Hoàng",
        time: "10:00",
      },
    ],
  };
}
