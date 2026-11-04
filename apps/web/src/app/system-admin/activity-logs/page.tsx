import type { Metadata } from "next";
import { SystemAdministratorActivityLogsScreen } from "@/modules/system-administrator/activity-logs/system-administrator-activity-logs-screen";

export const metadata: Metadata = {
  title: "Nhật ký hoạt động hệ thống",
};

export default function SystemAdministratorActivityLogsPage() {
  return <SystemAdministratorActivityLogsScreen />;
}
