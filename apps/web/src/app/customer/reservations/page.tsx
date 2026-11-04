import type { Metadata } from "next";
import { CustomerStorageHub } from "@/features/rentals/customer-storage-hub";

export const metadata: Metadata = {
  title: "Lịch hẹn & Đặt kho",
};

export default function CustomerReservationsPage() {
  return <CustomerStorageHub defaultTab="reservations" />;
}
