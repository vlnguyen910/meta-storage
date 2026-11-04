import type { Metadata } from "next";
import { OperationsFacilitiesScreen } from "@/modules/business-operations/business-operations-screens";

export const metadata: Metadata = {
  title: "Mạng lưới cơ sở",
};

export default function OperationsFacilitiesPage() {
  return <OperationsFacilitiesScreen />;
}
