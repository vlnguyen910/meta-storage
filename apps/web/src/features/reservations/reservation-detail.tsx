import { CustomerBookingDetail } from "@/features/bookings/customer-booking-view";
export function ReservationDetail({ reservationId }: { reservationId: string }) {
  return <CustomerBookingDetail id={reservationId} />;
}
