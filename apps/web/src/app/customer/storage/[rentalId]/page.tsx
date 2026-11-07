import { RentalDetail } from "@/features/rentals/rental-detail";

export default async function CustomerRentalDetailPage({
  params,
}: {
  params: Promise<{ rentalId: string }>;
}) {
  const { rentalId } = await params;
  return <RentalDetail rentalId={rentalId} />;
}
