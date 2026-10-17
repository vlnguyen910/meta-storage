import { redirect } from "next/navigation";
import { routes } from "@/config/routes";

export default async function FacilityDetailPage({
  params,
}: {
  params: Promise<{ facilityId: string }>;
}) {
  const { facilityId } = await params;
  redirect(`${routes.reservationNew}?facilityId=${encodeURIComponent(facilityId)}`);
}
