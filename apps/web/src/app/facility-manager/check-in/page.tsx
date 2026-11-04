import type { Metadata } from "next";
import { CheckInScreen } from "@/features/check-in/check-in-screen";

export const metadata: Metadata = {
  title: "Tiếp đón & Bàn giao",
};

export default function CheckInPage() {
  return <CheckInScreen />;
}
