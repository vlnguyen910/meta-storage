import type { Metadata } from "next";
import { CustomerSupportList } from "@/features/customer-support/support-screens";

export const metadata: Metadata = {
  title: "Trung tâm hỗ trợ",
};

export default function Page() {
  return <CustomerSupportList />;
}
