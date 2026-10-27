import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/display";
import { LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { checkoutMessages as m } from "@/features/reservations/checkout.messages";
import { ReservationWizard } from "@/features/reservations/reservation-wizard";

export function NewReservationScreen() {
  return (
    <>
      <Link
        href={customerRoutes.facilities}
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-primary"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {m.backToFacilities}
      </Link>
      <PageHeader title={m.customerTitle} description={m.customerDescription} />
      <Suspense fallback={<LoadingState variant="form" />}>
        <ReservationWizard />
      </Suspense>
    </>
  );
}
