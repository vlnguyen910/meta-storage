import { ReservationReceipt } from "./reservation-receipt";
export function ReservationDetail({ reservationId }: { reservationId: string }) {
  return <ReservationReceipt key={reservationId} reservationId={reservationId} />;
}
