import type { Metadata } from "next";
import { BusinessOperationsDashboardScreen } from "@/modules/business-operations/dashboard/business-operations-dashboard-screen";

export const metadata: Metadata = {
  title: "Báo cáo vận hành kinh doanh",
};

export default function OperationsDashboardPage() {
  return <BusinessOperationsDashboardScreen />;
}
