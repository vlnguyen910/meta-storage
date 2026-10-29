import { RenewalScreen } from "@/features/rentals/renewal-screen";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ rentalId: string }>;
  searchParams: Promise<{ renewalId?: string }>;
}) {
  const { rentalId } = await params;
  const { renewalId } = await searchParams;
  return (
    <RenewalScreen
      key={`${rentalId}:${renewalId ?? "new"}`}
      rentalId={rentalId}
      renewalId={renewalId ?? null}
    />
  );
}
