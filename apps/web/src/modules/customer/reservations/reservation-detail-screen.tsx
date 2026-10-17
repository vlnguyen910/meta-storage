import { ReservationDetail } from "@/features/reservations/reservation-detail";

export function ReservationDetailScreen({ reservationId }: { reservationId: string }) {
  return <ReservationDetail reservationId={reservationId} />;
}
