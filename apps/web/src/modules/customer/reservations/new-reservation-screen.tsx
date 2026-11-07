import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import { ReservationWizard } from "@/features/reservations/reservation-wizard";

export function NewReservationScreen() {
  return (
    <Suspense fallback={<LoadingState variant="form" />}>
      <ReservationWizard />
    </Suspense>
  );
}
