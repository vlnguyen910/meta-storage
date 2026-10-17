import type { Metadata } from "next";
import { BookingTrackingScreen } from "@/features/booking-tracking/booking-tracking-screen";
import { trackingMessages } from "@/features/booking-tracking/tracking.messages";
export const metadata: Metadata = {
  title: trackingMessages.title,
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default function BookingTrackingPage() {
  return <BookingTrackingScreen />;
}
