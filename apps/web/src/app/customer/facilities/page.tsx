import type { Metadata } from "next";
import { CustomerFacilitiesScreen } from "@/modules/customer/facilities/customer-facilities-screen";

export const metadata: Metadata = {
  title: "Danh sách cơ sở",
};

export default function CustomerFacilitiesPage() {
  return <CustomerFacilitiesScreen />;
}
