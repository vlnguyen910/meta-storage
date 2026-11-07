import type { DashboardSummary } from "@metastorage/contracts";

export function facilityManagerDashboard(
  facilityName: string | undefined,
  availableUnits: number,
  totalUnits: number,
): DashboardSummary {
  return {
    title: "Tổng quan cơ sở",
    subtitle: "Hiệu suất vận hành và tình trạng kho trong ngày.",
    facilityName,
    kpis: [
      {
        label: "Tỷ lệ lấp đầy",
        value: `${Math.round((1 - availableUnits / totalUnits) * 100)}%`,
        helper: `${availableUnits} kho còn trống`,
        tone: "primary",
      },
      {
        label: "Doanh thu tháng",
        value: "186 triệu",
        helper: "+8,4% so với tháng trước",
        tone: "accent",
      },
      { label: "Sắp quá hạn", value: "7", helper: "Trong 14 ngày tới", tone: "warning" },
      { label: "Đang bảo trì", value: "1", helper: "Dự kiến xong ngày mai", tone: "neutral" },
    ],
    activities: [
      {
        id: "m1",
        title: "Reservation mới đã xác nhận",
        description: "Kho tiêu chuẩn · 4 m²",
        time: "09:12",
      },
      {
        id: "m2",
        title: "Hoàn tất kiểm tra định kỳ",
        description: "4 storage unit đạt yêu cầu",
        time: "08:45",
      },
    ],
  };
}
