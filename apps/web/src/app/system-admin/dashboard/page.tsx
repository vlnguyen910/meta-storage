import type { Metadata } from "next";
import { SystemAdministratorDashboardScreen } from "@/modules/system-administrator/dashboard/system-administrator-dashboard-screen";

export const metadata: Metadata = {
  title: "Bảng điều khiển quản trị",
};

export default function SystemAdminDashboardPage() {
  return <SystemAdministratorDashboardScreen />;
}
