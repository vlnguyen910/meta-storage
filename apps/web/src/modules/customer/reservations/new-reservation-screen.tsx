import { Suspense } from "react";
import { PageHeader } from "@/components/ui/display";
import { LoadingState } from "@/components/ui/states";
import { ReservationWizard } from "@/features/reservations/reservation-wizard";

export function NewReservationScreen() {
  return (
    <>
      <PageHeader
        eyebrow="Reservation flow"
        title="Đặt kho mới"
        description="Hoàn tất 5 bước để giữ chỗ theo loại và kích thước kho."
      />
      <Suspense fallback={<LoadingState />}>
        <ReservationWizard />
      </Suspense>
    </>
  );
}
