import { ReservationDetailScreen } from "@/modules/customer/reservations/reservation-detail-screen";
export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = await params;
  return <ReservationDetailScreen reservationId={reservationId} />;
}
