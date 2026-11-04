import type { Metadata } from "next";
import { FacilityManagerDashboardScreen } from "@/modules/facility-manager/dashboard/facility-manager-dashboard-screen";

export const metadata: Metadata = {
  title: "Vận hành cơ sở",
};

export default function ManagerDashboardPage() {
  return <FacilityManagerDashboardScreen />;
}
