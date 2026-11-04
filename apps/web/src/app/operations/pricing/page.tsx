import type { Metadata } from "next";
import { OperationsPricingScreen } from "@/modules/business-operations/business-operations-screens";

export const metadata: Metadata = {
  title: "Cấu hình giá",
};

export default function OperationsPricingPage() {
  return <OperationsPricingScreen />;
}
