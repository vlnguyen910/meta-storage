import type { Metadata } from "next";
import { CustomerDashboardScreen } from "@/modules/customer/dashboard/customer-dashboard-screen";

export const metadata: Metadata = {
  title: "Tổng quan dịch vụ",
};

export default function CustomerDashboardPage() {
  return <CustomerDashboardScreen />;
}
