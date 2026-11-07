import type { Metadata } from "next";
import { CustomerTransactionsScreen } from "@/features/rentals/customer-transactions-screen";

export const metadata: Metadata = {
  title: "Lịch sử giao dịch",
};

export default function CustomerTransactionsPage() {
  return <CustomerTransactionsScreen />;
}
