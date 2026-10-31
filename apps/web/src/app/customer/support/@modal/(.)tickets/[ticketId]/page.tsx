import { SupportTicketParamsSchema } from "@metastorage/contracts";
import { notFound } from "next/navigation";
import { CustomerSupportDetailScreen } from "@/modules/customer/support/customer-support-detail-screen";

export default async function Page({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  if (!SupportTicketParamsSchema.safeParse({ ticketId }).success) notFound();
  return <CustomerSupportDetailScreen ticketId={ticketId} intercepted />;
}
