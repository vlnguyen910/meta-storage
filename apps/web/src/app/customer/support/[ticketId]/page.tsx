import { SupportTicketParamsSchema } from "@metastorage/contracts";
import { notFound, redirect } from "next/navigation";
import { customerRoutes } from "@/config/routes";

export default async function Page({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  if (!SupportTicketParamsSchema.safeParse({ ticketId }).success) notFound();
  redirect(customerRoutes.supportTicket(ticketId));
}
