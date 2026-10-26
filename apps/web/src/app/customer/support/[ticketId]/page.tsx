import { CustomerSupportDetail } from "@/features/customer-support/support-screens";
export default async function Page({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  return <CustomerSupportDetail ticketId={ticketId} />;
}
