import type { Metadata } from "next";
import { ManagerRentalsScreen } from "@/modules/facility-manager/manager-rentals-screen";

export const metadata: Metadata = {
  title: "Khách thuê & Hợp đồng",
};

export default function Page() {
  return <ManagerRentalsScreen />;
}
