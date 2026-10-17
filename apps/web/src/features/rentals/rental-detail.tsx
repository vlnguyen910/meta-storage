"use client";

import Link from "next/link";
import { Card, PageHeader, StatusBadge } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { formatDate } from "@/lib/format";
import { useRental } from "./hooks";

export function RentalDetail({ rentalId }: { rentalId: string }) {
  const query = useRental(rentalId);
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return (
      <ErrorState
        message="Rental không tồn tại hoặc bạn không có quyền truy cập."
        onRetry={() => query.refetch()}
      />
    );
  }
  const rental = query.data;
  return (
    <>
      <PageHeader
        eyebrow="My Storage"
        title={rental.bookingCode}
        description={`${rental.facility.name} · ${rental.unitType.name}`}
        action={
          <Link href={customerRoutes.rentals}>
            Quay lại My Storage (Nút này sau này sửa lại cho đẹp hơn)
          </Link>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="grid gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                {rental.unitType.name} · {rental.unitType.sizeLabel}
              </h2>
              <p className="m-0 text-muted">{rental.facility.address}</p>
            </div>
            <StatusBadge value={rental.status} />
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-line pt-5">
            <div>
              <small className="block text-muted">Bắt đầu</small>
              <strong>{formatDate(rental.startAt)}</strong>
            </div>
            <div>
              <small className="block text-muted">Dự kiến kết thúc</small>
              <strong>{formatDate(rental.expectedEndAt)}</strong>
            </div>
            <div>
              <small className="block text-muted">Physical unit</small>
              <strong>{rental.physicalUnit?.code ?? "Chưa phân công"}</strong>
            </div>
            <div>
              <small className="block text-muted">Booking status</small>
              <strong>{rental.bookingStatus}</strong>
            </div>
          </div>
        </Card>
        <Card>
          <h2 className="mb-5 text-xl font-bold">Tiến trình Rental</h2>
          <div className="grid gap-4">
            {rental.timeline.map((event) => (
              <div
                key={event.label}
                className="flex items-center justify-between gap-4 border-b border-line pb-3 last:border-0"
              >
                <span>{event.label}</span>
                <strong className="text-sm text-muted">
                  {event.at ? formatDate(event.at) : event.status}
                </strong>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="mt-5 border-primary/20 bg-primary-soft">
        <strong>Chế độ xem hiện tại</strong>
        <p className="mb-0 mt-1 text-muted">{rental.actions.note}</p>
      </Card>
    </>
  );
}
