import { FacilityReturnDetail } from "@/features/returns/facility-return-detail";

export default async function StaffReturnDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <FacilityReturnDetail requestId={requestId} actorRole="FACILITY_STAFF" />;
}
