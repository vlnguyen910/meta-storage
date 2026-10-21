import type { Metadata } from "next";
import { bookingLookupMessages } from "@/features/booking-tracking/booking-lookup.messages";
import { BookingTrackingScreen } from "@/features/booking-tracking/booking-tracking-screen";
export const metadata: Metadata = {
  title: bookingLookupMessages.title,
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default function BookingTrackingPage() {
  return <BookingTrackingScreen />;
}
