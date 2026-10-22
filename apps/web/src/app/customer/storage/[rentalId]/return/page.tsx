import { CustomerReturnForm } from "@/features/returns/customer-return-form";

export default async function NewReturnPage({ params }: { params: Promise<{ rentalId: string }> }) {
  const { rentalId } = await params;
  return <CustomerReturnForm rentalId={rentalId} />;
}
