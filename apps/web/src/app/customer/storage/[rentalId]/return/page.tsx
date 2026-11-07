import { RentalIdParamsSchema } from "@metastorage/contracts";
import { notFound, redirect } from "next/navigation";
import { customerRoutes } from "@/config/routes";

export default async function Page({ params }: { params: Promise<{ rentalId: string }> }) {
  const { rentalId } = await params;
  if (!RentalIdParamsSchema.safeParse({ rentalId }).success) notFound();
  redirect(customerRoutes.rental(rentalId));
}
