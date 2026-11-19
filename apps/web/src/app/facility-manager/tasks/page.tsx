import type { Metadata } from "next";
import { ManagerTasksScreen } from "@/modules/facility-manager/facility-operations-screens";

export const metadata: Metadata = {
  title: "Điều phối công việc",
};

export default function ManagerTasksPage() {
  return <ManagerTasksScreen />;
}
