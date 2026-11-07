import type { Metadata } from "next";
import { OperationsReportsScreen } from "@/modules/business-operations/business-operations-screens";

export const metadata: Metadata = {
  title: "Báo cáo doanh thu & công suất",
};

export default function OperationsReportsPage() {
  return <OperationsReportsScreen />;
}
