import { CustomerReturnDetail } from "@/features/returns/customer-return-detail";

export default async function ReturnRequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <CustomerReturnDetail requestId={requestId} />;
}
