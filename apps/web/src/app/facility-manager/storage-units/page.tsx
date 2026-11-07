import type { Metadata } from "next";
import { ManagerInventoryScreen } from "@/modules/facility-manager/facility-operations-screens";

export const metadata: Metadata = {
  title: "Quản lý ô kho",
};

export default function ManagerInventoryPage() {
  return <ManagerInventoryScreen />;
}
