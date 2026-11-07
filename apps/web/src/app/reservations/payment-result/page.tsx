import { redirect } from "next/navigation";
import { customerRoutes } from "@/config/routes";

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["paymentId", "reservationId", "bookingId", "status"]) {
    const value = input[key];
    if (typeof value === "string") params.set(key, value);
  }
  redirect(`${customerRoutes.paymentResult}?${params}`);
}
