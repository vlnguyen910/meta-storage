import type { DashboardSummary } from "@metastorage/contracts";
import type { MockDatabase } from "../../types";

export function businessOperationsDashboard(
  database: MockDatabase,
  availableUnits: number,
): DashboardSummary {
  return {
    title: "Điều hành toàn hệ thống",
    subtitle: "So sánh hiệu suất giữa các cơ sở metastorage.",
    kpis: [
      {
        label: "Cơ sở hoạt động",
        value: String(database.facilities.length),
        helper: "3/3 vận hành bình thường",
        tone: "primary",
      },
      {
        label: "Kho còn trống",
        value: String(availableUnits),
        helper: "Trên toàn hệ thống",
        tone: "accent",
      },
      {
        label: "Doanh thu tháng",
        value: "492 triệu",
        helper: "+11,2% so với tháng trước",
        tone: "primary",
      },
      { label: "Tỷ lệ lấp đầy", value: "78%", helper: "Mục tiêu tháng: 80%", tone: "warning" },
    ],
    activities: database.facilities.map((facility, index) => ({
      id: facility.id,
      title: facility.name,
      description: `${facility.availableUnits} unit còn trống`,
      time: `${82 - index * 5}% lấp đầy`,
    })),
  };
}
