import type { Metadata } from "next";
import { StaffTasksScreen } from "@/modules/facility-staff/staff-tasks-screen";

export const metadata: Metadata = {
  title: "Bàn làm việc nhân viên",
};

export default function StaffDashboardPage() {
  return <StaffTasksScreen />;
}
