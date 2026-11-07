import type { Metadata } from "next";
import { StaffTasksScreen } from "@/modules/facility-staff/staff-tasks-screen";

export const metadata: Metadata = {
  title: "Danh sách công việc",
};

export default function StaffTasksPage() {
  return <StaffTasksScreen />;
}
