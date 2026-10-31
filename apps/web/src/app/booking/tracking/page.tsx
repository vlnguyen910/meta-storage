import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isMockMode } from "@/config/api-mode";
import { customerRoutes } from "@/config/routes";
import { bookingLookupMessages } from "@/features/booking-tracking/booking-lookup.messages";
import { BookingTrackingScreen } from "@/features/booking-tracking/booking-tracking-screen";
export const metadata: Metadata = {
  title: bookingLookupMessages.title,
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default function BookingTrackingPage() {
  if (!isMockMode) redirect(customerRoutes.reservations);
  return <BookingTrackingScreen />;
}
