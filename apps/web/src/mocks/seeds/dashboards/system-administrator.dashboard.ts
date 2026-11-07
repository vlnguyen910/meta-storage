import type { DashboardSummary } from "@metastorage/contracts";

export function systemAdministratorDashboard(): DashboardSummary {
  return {
    title: "Quản trị hệ thống",
    subtitle: "Tài khoản, phân quyền và hoạt động quan trọng.",
    kpis: [
      { label: "Tài khoản", value: "128", helper: "5 role đang hoạt động", tone: "primary" },
      { label: "Đăng nhập hôm nay", value: "76", helper: "Không có bất thường", tone: "accent" },
      { label: "Tài khoản bị khóa", value: "2", helper: "Đang chờ xem xét", tone: "warning" },
      { label: "Activity log", value: "1.248", helper: "Trong 30 ngày gần nhất", tone: "neutral" },
    ],
    activities: [
      {
        id: "s1",
        title: "Cập nhật quyền Facility Manager",
        description: "Thực hiện bởi Đỗ An Nhiên",
        time: "09:20",
      },
      {
        id: "s2",
        title: "Gán nhân viên vào HCM-01",
        description: "Tài khoản staff@metastorage.test",
        time: "Hôm qua",
      },
    ],
  };
}
