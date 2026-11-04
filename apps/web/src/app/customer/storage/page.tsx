import type { Metadata } from "next";
import { CustomerStorageHub } from "@/features/rentals/customer-storage-hub";

export const metadata: Metadata = {
  title: "Kho của tôi",
};

export default function CustomerStoragePage() {
  return <CustomerStorageHub defaultTab="rentals" />;
}
